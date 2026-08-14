import { describe, expect, test, vi } from 'vitest'

import { MailingService } from './MailingService.js'

// A stub Payload whose `find`/`findByID`/`update`/`email.sendEmail` are spies,
// so the send path (claim -> fetch -> send -> terminal update) is exercised
// without a database. Matches the shape `MailingService.render.test.ts` already
// uses (`{ db: {}, email: {} }`), extended with the calls this path makes.
const stubPayload = () =>
  ({
    db: {},
    email: { sendEmail: vi.fn().mockResolvedValue(undefined) },
    find: vi.fn().mockResolvedValue({ docs: [] }),
    findByID: vi.fn(),
    update: vi.fn(),
  }) as any

const makeService = (payload: any, config: Record<string, any> = {}) =>
  new MailingService(payload, config as any)

const baseEmail = (overrides: Record<string, any> = {}) => ({
  id: '1',
  attempts: 0,
  bcc: null,
  cc: null,
  from: 'sender@example.com',
  fromName: null,
  html: '<p>hi</p>',
  replyTo: null,
  subject: 'Hello',
  text: null,
  to: 'user@example.com',
  ...overrides,
})

describe('processEmailItem — the atomic claim', () => {
  test('the claim update guards on id + expectedStatus and sets status: processing', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = makeService(payload)

    await svc.processEmailItem('1', 'pending')

    const claimCall = payload.update.mock.calls[0][0]
    expect(claimCall.where).toEqual({
      and: [{ id: { equals: '1' } }, { status: { equals: 'pending' } }],
    })
    expect(claimCall.data.status).toBe('processing')
  })

  test('losing the claim (docs: []) is a clean no-op: no send, no findByID, no further update', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [] })
    const svc = makeService(payload)

    await svc.processEmailItem('1', 'pending')

    expect(payload.email.sendEmail).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledTimes(1)
  })
})

describe('expectedStatus is threaded through the scheduled entry points', () => {
  test('processEmails claims candidates against "pending"', async () => {
    const payload = stubPayload()
    payload.find.mockResolvedValue({ docs: [{ id: '1' }] })
    // Losing the claim keeps this test to a single update call.
    payload.update.mockResolvedValue({ docs: [] })
    const svc = makeService(payload)

    await svc.processEmails()

    const claimCall = payload.update.mock.calls[0][0]
    expect(claimCall.where.and[1]).toEqual({ status: { equals: 'pending' } })
  })

  test('retryFailedEmails claims candidates against "failed"', async () => {
    const payload = stubPayload()
    payload.find.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.update.mockResolvedValue({ docs: [] })
    const svc = makeService(payload)

    await svc.retryFailedEmails()

    const claimCall = payload.update.mock.calls[0][0]
    expect(claimCall.where.and[1]).toEqual({ status: { equals: 'failed' } })
  })
})

describe('processEmailItem — success', () => {
  test('a resolving send writes status: sent, an ISO sentAt, and error: null', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = makeService(payload)

    await svc.processEmailItem('1', 'pending')

    expect(payload.email.sendEmail).toHaveBeenCalledTimes(1)
    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.status).toBe('sent')
    expect(finalCall.data.error).toBeNull()
    expect(new Date(finalCall.data.sentAt).toISOString()).toBe(finalCall.data.sentAt)
  })
})

describe('processEmailItem — failure walks the attempt budget', () => {
  test('attempts 0 -> 1 (< maxAttempts) goes back to pending with the error message stored', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ attempts: 0 }))
    payload.email.sendEmail.mockRejectedValue(new Error('smtp down'))
    const svc = makeService(payload, { retryAttempts: 3 })

    await expect(svc.processEmailItem('1', 'pending')).resolves.toBeUndefined()

    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.status).toBe('pending')
    expect(finalCall.data.error).toBe('smtp down')

    const attemptsUpdate = payload.update.mock.calls.find((call) => call[0].data.attempts !== undefined)
    expect(attemptsUpdate[0].data.attempts).toBe(1)
  })

  test('attempts 2 -> 3 (== maxAttempts) goes to failed', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ attempts: 2 }))
    payload.email.sendEmail.mockRejectedValue(new Error('smtp down'))
    const svc = makeService(payload, { retryAttempts: 3 })

    await svc.processEmailItem('1', 'pending')

    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.status).toBe('failed')
  })

  test('a thrown non-Error stores the string "Unknown error"', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ attempts: 0 }))
    payload.email.sendEmail.mockRejectedValue('not an Error object')
    const svc = makeService(payload, { retryAttempts: 3 })

    await svc.processEmailItem('1', 'pending')

    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.error).toBe('Unknown error')
  })

  test('processEmailItem does not reject when the send fails', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail())
    payload.email.sendEmail.mockRejectedValue(new Error('boom'))
    const svc = makeService(payload, { retryAttempts: 3 })

    await expect(svc.processEmailItem('1', 'pending')).resolves.toBeUndefined()
  })
})

describe('processEmailItem — field validation routes into the attempt-increment path', () => {
  const attemptCase = async (emailOverrides: Record<string, any>, expectedError: string) => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail(emailOverrides))
    const svc = makeService(payload)

    await expect(svc.processEmailItem('1', 'pending')).resolves.toBeUndefined()

    expect(payload.email.sendEmail).not.toHaveBeenCalled()
    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.error).toBe(expectedError)
  }

  test('missing "from" with no defaultFrom configured', async () => {
    await attemptCase({ from: null }, 'Email from field is required')
  })

  test('empty "to"', async () => {
    await attemptCase({ to: [] }, 'Email to field is required')
  })

  test('missing "subject"', async () => {
    await attemptCase({ subject: null }, 'Email subject is required')
  })

  test('neither "html" nor "text"', async () => {
    await attemptCase({ html: null, text: null }, 'Email content is required')
  })
})

describe('processEmailItem — beforeSend hook', () => {
  test('a hook returning a modified mailOptions object sends the modified one', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail())
    const beforeSend = vi.fn((mailOptions: any) => ({ ...mailOptions, subject: 'Modified subject' }))
    const svc = makeService(payload, { beforeSend })

    await svc.processEmailItem('1', 'pending')

    expect(payload.email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Modified subject' }),
    )
  })

  // The post-hook re-validation (MailingService.ts:474-485) exists so a buggy
  // host-app hook cannot send a headless or senderless email; each field is
  // asserted separately.
  const hookFailureCase = async (mutate: (mailOptions: any) => any, expectedError: string) => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail())
    const beforeSend = vi.fn((mailOptions: any) => mutate({ ...mailOptions }))
    const svc = makeService(payload, { beforeSend })

    await svc.processEmailItem('1', 'pending')

    expect(payload.email.sendEmail).not.toHaveBeenCalled()
    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.error).toBe(expectedError)
  }

  test('a hook that removes "from" fails with the guard message', async () => {
    await hookFailureCase(
      (mailOptions) => ({ ...mailOptions, from: '' }),
      'beforeSend hook failed: beforeSend hook must not remove the "from" property',
    )
  })

  test('a hook that empties "to" fails with the guard message', async () => {
    await hookFailureCase(
      (mailOptions) => ({ ...mailOptions, to: undefined }),
      'beforeSend hook failed: beforeSend hook must not remove or empty the "to" property',
    )
  })

  test('a hook that removes "subject" fails with the guard message', async () => {
    await hookFailureCase(
      (mailOptions) => ({ ...mailOptions, subject: '' }),
      'beforeSend hook failed: beforeSend hook must not remove the "subject" property',
    )
  })

  test('a hook that removes both "html" and "text" fails with the guard message', async () => {
    await hookFailureCase(
      (mailOptions) => ({ ...mailOptions, html: undefined, text: undefined }),
      'beforeSend hook failed: beforeSend hook must not remove both "html" and "text" properties',
    )
  })
})

describe('processEmailItem — address formatting reaches the wire', () => {
  test('from + fromName arrives quoted, with embedded quotes escaped', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ from: 'a@b.com', fromName: 'Ada "The" Lovelace' }))
    const svc = makeService(payload)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('"Ada \\"The\\" Lovelace" <a@b.com>')
  })

  test('a whitespace-only fromName yields the bare address, no empty "" <...> prefix', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ from: 'a@b.com', fromName: '   ' }))
    const svc = makeService(payload)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('a@b.com')
  })

  test('no from on the email at all: defaultFrom/defaultFromName supply it', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [{ id: '1' }] })
    payload.findByID.mockResolvedValue(baseEmail({ from: null, fromName: null }))
    const svc = makeService(payload, { defaultFrom: 'default@example.com', defaultFromName: 'Default Sender' })

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('"Default Sender" <default@example.com>')
  })
})

describe('processEmails — selection query', () => {
  test('requests at most 50 pending rows, due now or unscheduled', async () => {
    const payload = stubPayload()
    const svc = makeService(payload)

    await svc.processEmails()

    expect(payload.find).toHaveBeenCalledTimes(1)
    const findCall = payload.find.mock.calls[0][0]
    expect(findCall.limit).toBe(50)
    expect(findCall.where.and[0]).toEqual({ status: { equals: 'pending' } })
    expect(findCall.where.and[1].or).toEqual([
      { scheduledAt: { exists: false } },
      { scheduledAt: { less_than_equal: expect.any(String) } },
    ])
  })
})
