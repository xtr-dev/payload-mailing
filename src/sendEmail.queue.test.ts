import { describe, expect, test, vi } from 'vitest'

import Emails from './collections/Emails.js'
import { sendEmail } from './sendEmail.js'

const emailData = { html: '<p>hi</p>', subject: 'subject', to: 'user@example.com' }

const makePayload = (): any => ({
  find: vi.fn().mockResolvedValue({ docs: [] }),
  jobs: {
    queue: vi.fn().mockResolvedValue({ id: 'job-1' }),
    run: vi.fn().mockResolvedValue(undefined),
  },
  mailing: {
    collections: { emails: 'emails', templates: 'email-templates' },
    config: { queue: 'plugin-queue' },
  },
})

describe('SendEmailOptions.queue', () => {
  test('passes the override through the normal afterChange scheduling path', async () => {
    const payload = makePayload()
    payload.create = vi.fn().mockImplementation(async ({ context }: any) => {
      const doc = { id: 'email-1', status: 'pending', ...emailData }
      const afterChange = (Emails.hooks as any).afterChange[0]
      await afterChange({ doc, operation: 'create', previousDoc: undefined, req: { context, payload } })
      return doc
    })

    await sendEmail(payload, { data: emailData as never, queue: 'high' })

    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({ queue: 'high' }))
  })

  test('keeps the plugin queue when a normal send has no override', async () => {
    const payload = makePayload()
    payload.create = vi.fn().mockImplementation(async ({ context }: any) => {
      const doc = { id: 'email-1', status: 'pending', ...emailData }
      const afterChange = (Emails.hooks as any).afterChange[0]
      await afterChange({ doc, operation: 'create', previousDoc: undefined, req: { context, payload } })
      return doc
    })

    await sendEmail(payload, { data: emailData as never })

    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({ queue: 'plugin-queue' }))
  })

  test('passes the override when immediate processing falls back to scheduling itself', async () => {
    const payload = makePayload()
    // No hook means no handed-off job ID, exercising sendEmail's fallback.
    payload.create = vi.fn().mockResolvedValue({ id: 'email-1', status: 'pending', ...emailData })

    await sendEmail(payload, { data: emailData as never, processImmediately: true, queue: 'high' })

    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({ queue: 'high' }))
    expect(payload.jobs.run).toHaveBeenCalled()
  })
})
