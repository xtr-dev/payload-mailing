import { describe, expect, test, vi } from 'vitest'

import Emails from './collections/Emails.js'
import { sendEmail } from './sendEmail.js'

/**
 * SendEmailOptions.queue travels two different routes to payload.jobs.queue:
 *
 * - Normal send: the Emails afterChange hook queues the job, so sendEmail hands
 *   the queue name to the hook through the create operation's context object.
 * - processImmediately with no hook handoff (custom collection without the
 *   plugin's hook): sendEmail calls ensureEmailJob itself.
 *
 * Both are covered here because the option was previously declared and
 * documented but read on neither path.
 */

const emailData = { html: '<p>hi</p>', subject: 'subject', to: 'user@example.com' }

const makePayload = () => {
  const payload: any = {
    // findExistingJobs pre-check inside ensureEmailJob: no existing jobs.
    find: vi.fn().mockResolvedValue({ docs: [] }),
    jobs: {
      queue: vi.fn().mockResolvedValue({ id: 'job-1' }),
      run: vi.fn().mockResolvedValue(undefined),
    },
    mailing: {
      collections: { emails: 'emails', templates: 'email-templates' },
      config: { queue: 'plugin-queue' },
    },
  }
  return payload
}

describe('SendEmailOptions.queue', () => {
  test('normal send: the queue override reaches the afterChange hook through the create context', async () => {
    const payload = makePayload()
    // Simulate what Payload does on create: run the Emails afterChange hook
    // with req.context set to the context object passed into payload.create.
    payload.create = vi.fn().mockImplementation(async ({ context }: any) => {
      const doc = { id: 'email-1', status: 'pending', ...emailData }
      const afterChange = (Emails.hooks as any).afterChange[0]
      await afterChange({ doc, operation: 'create', previousDoc: undefined, req: { context, payload } })
      return doc
    })

    await sendEmail(payload, { data: emailData, queue: 'high' })

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'high' })
    )
  })

  test('normal send without an override: the hook uses the plugin config queue', async () => {
    const payload = makePayload()
    payload.create = vi.fn().mockImplementation(async ({ context }: any) => {
      const doc = { id: 'email-1', status: 'pending', ...emailData }
      const afterChange = (Emails.hooks as any).afterChange[0]
      await afterChange({ doc, operation: 'create', previousDoc: undefined, req: { context, payload } })
      return doc
    })

    await sendEmail(payload, { data: emailData })

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'plugin-queue' })
    )
  })

  test('processImmediately fallback (no hook handoff): sendEmail queues on the requested queue itself', async () => {
    const payload = makePayload()
    // A create that runs no hooks, so the context stays empty and sendEmail
    // takes its own ensureEmailJob fallback path.
    payload.create = vi.fn().mockResolvedValue({ id: 'email-1', status: 'pending', ...emailData })

    await sendEmail(payload, { data: emailData, processImmediately: true, queue: 'high' })

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'high' })
    )
    expect(payload.jobs.run).toHaveBeenCalled()
  })
})
