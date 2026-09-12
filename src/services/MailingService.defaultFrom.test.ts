import { describe, expect, test, vi } from 'vitest'

import { MailingService } from './MailingService.js'

// README.md documents `defaultFrom`/`defaultFromName` as the sender used when
// a send omits `from`, resolved in processEmailItem via getDefaultFrom(). This
// pins that resolution at the payload.email.sendEmail boundary so a regression
// that skips it (empty From, or bypassing the configured address) is caught.
const stubPayload = () =>
  ({
    db: {},
    email: { sendEmail: vi.fn().mockResolvedValue(undefined) },
    findByID: vi.fn(),
    update: vi.fn().mockResolvedValue({ docs: [{ id: '1' }] }),
  }) as any

const baseEmail = (overrides: Record<string, any> = {}) => ({
  id: '1',
  attempts: 0,
  bcc: null,
  cc: null,
  from: null,
  fromName: null,
  html: '<p>hi</p>',
  replyTo: null,
  subject: 'Hello',
  text: null,
  to: 'user@example.com',
  ...overrides,
})

describe('processEmailItem — defaultFrom/defaultFromName', () => {
  test('omitted from + defaultFrom only: from is the bare default address', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = new MailingService(payload, { defaultFrom: 'ops@example.com' } as any)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('ops@example.com')
  })

  test('omitted from + defaultFrom and defaultFromName: from is quoted "name" <address>', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = new MailingService(payload, {
      defaultFrom: 'ops@example.com',
      defaultFromName: 'Ops Team',
    } as any)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('"Ops Team" <ops@example.com>')
  })

  test('an explicit per-email from wins over a different configured defaultFrom', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(baseEmail({ from: 'user@example.com' }))
    const svc = new MailingService(payload, { defaultFrom: 'ops@example.com' } as any)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).toBe('user@example.com')
  })

  test('neither from nor defaultFrom: refused before send, sendEmail not called', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = new MailingService(payload, {} as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.email.sendEmail).not.toHaveBeenCalled()
    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.error).toBe('Email from field is required')
  })

  test('defaultFromName carrying CR/LF reaches the wire with neither, per formatEmailAddress’s header-injection guard', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(baseEmail())
    const svc = new MailingService(payload, {
      defaultFrom: 'ops@example.com',
      defaultFromName: 'Ops\r\nTeam',
    } as any)

    await svc.processEmailItem('1', 'pending')

    const sent = payload.email.sendEmail.mock.calls[0][0]
    expect(sent.from).not.toMatch(/[\r\n]/)
    expect(sent.from).toBe('"Ops  Team" <ops@example.com>')
  })
})
