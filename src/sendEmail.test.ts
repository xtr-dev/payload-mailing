import { describe, expect, test, vi } from 'vitest'

import { sendEmail } from './sendEmail.js'

// A stub Payload with a spyable `create` and just enough of the mailing
// context (`payload.mailing`, read via getMailing) for sendEmail to resolve
// the target collection. No database or job queue is exercised here — these
// tests are about what sendEmail hands to payload.create, not persistence.
const buildPayload = () => {
  const create = vi.fn(async ({ data }: any) => ({ id: 'email-1', ...data }))
  const payload: any = {
    create,
    mailing: { collections: { emails: 'emails', templates: 'email-templates' } },
  }
  return { create, payload }
}

// `SendEmailOptions.data` types `to`/`cc`/`bcc`/`from`/`replyTo` off the
// stored BaseEmailDocument shape (array-only for to/cc/bcc, scalar-only for
// from/replyTo), but sendEmail's runtime accepts the more permissive
// string | string[] documented in its own JSDoc example and the README. That
// input-type gap is pre-existing and out of scope for this coverage — cast
// through `any` so these tests exercise the documented runtime contract.
const baseData = { html: '<p>hi</p>', subject: 'hi', to: 'user@example.com' } as any

describe('sendEmail — recipient normalization', () => {
  test('normalizes a comma-separated "to" string into an array', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, to: 'a@example.com, b@example.com' } })
    expect(create.mock.calls[0][0].data.to).toEqual(['a@example.com', 'b@example.com'])
  })

  test('passes an array "to" through as an array', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, to: ['a@example.com', 'b@example.com'] } })
    expect(create.mock.calls[0][0].data.to).toEqual(['a@example.com', 'b@example.com'])
  })

  test('normalizes cc and bcc the same way, and omits them when not supplied', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, bcc: 'bcc@example.com', cc: 'cc1@example.com,cc2@example.com' } })
    const sent = create.mock.calls[0][0].data
    expect(sent.cc).toEqual(['cc1@example.com', 'cc2@example.com'])
    expect(sent.bcc).toEqual(['bcc@example.com'])
  })

  test('reduces replyTo to a single address, not an array, keeping the first', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, replyTo: 'reply@example.com, second@example.com' } })
    expect(create.mock.calls[0][0].data.replyTo).toBe('reply@example.com')
  })

  test('reduces "from" to a single address, not an array, keeping the first', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, from: ['from@example.com', 'second@example.com'] } })
    expect(create.mock.calls[0][0].data.from).toBe('from@example.com')
  })

  test('the caller-supplied recipient set round-trips exactly: nothing dropped, nothing added', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, {
      data: { ...baseData, bcc: ['bcc@example.com'], cc: ['cc@example.com'], to: ['a@example.com', 'b@example.com'] },
    })
    const sent = create.mock.calls[0][0].data
    expect(sent.to).toEqual(['a@example.com', 'b@example.com'])
    expect(sent.cc).toEqual(['cc@example.com'])
    expect(sent.bcc).toEqual(['bcc@example.com'])
  })
})

describe('sendEmail — malformed address refusal', () => {
  test('rejects an invalid "to" address before creating anything', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { ...baseData, to: 'not-an-email' } })).rejects.toThrow(/Invalid email addresses/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects a CR/LF header-injection payload smuggled into "to"', async () => {
    const { create, payload } = buildPayload()
    await expect(
      sendEmail(payload, { data: { ...baseData, to: 'victim@example.com\r\nBcc: attacker@evil.com' } })
    ).rejects.toThrow(/Invalid email addresses/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects a malformed "cc" address even when "to" is valid', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { ...baseData, cc: 'not-an-email' } })).rejects.toThrow(/Invalid email addresses/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects a malformed "replyTo" address', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { ...baseData, replyTo: 'not-an-email' } })).rejects.toThrow(/Invalid email addresses/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects a malformed "from" address', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { ...baseData, from: 'not-an-email' } })).rejects.toThrow(/Invalid email addresses/)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('sendEmail — fromName sanitization', () => {
  test('strips a CR/LF header-injection payload from fromName before creating', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, fromName: 'Attacker\r\nBcc: attacker@evil.com' } })
    expect(create.mock.calls[0][0].data.fromName).toBe('Attacker  Bcc: attacker@evil.com')
  })

  test('a quoted display name survives sanitization with its quotes intact', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: { ...baseData, fromName: '"Jane Doe"' } })
    expect(create.mock.calls[0][0].data.fromName).toBe('"Jane Doe"')
  })

  test('an absent fromName stays undefined rather than becoming a literal "undefined"', async () => {
    const { create, payload } = buildPayload()
    await sendEmail(payload, { data: baseData })
    expect(create.mock.calls[0][0].data.fromName).toBeUndefined()
  })
})

describe('sendEmail — required-field refusal', () => {
  test('rejects when "to" is missing, before creating anything', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'hi' } as any })).rejects.toThrow(/"to" is required/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects a direct (non-template) send missing subject/html', async () => {
    const { create, payload } = buildPayload()
    await expect(sendEmail(payload, { data: { to: 'user@example.com' } as any })).rejects.toThrow(/"subject" and "html" are required/)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('sendEmail — success path', () => {
  test('returns the document payload.create resolved with', async () => {
    const { payload } = buildPayload()
    const email = await sendEmail(payload, { data: baseData })
    expect(email.id).toBe('email-1')
    expect(email.to).toEqual(['user@example.com'])
  })
})
