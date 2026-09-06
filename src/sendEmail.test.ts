import { describe, expect, test, vi } from 'vitest'

import Emails from './collections/Emails.js'
import { sendEmail } from './sendEmail.js'

// SendEmailOptions.queue is documented as a per-send queue override. It has two
// delivery paths to the job that actually gets queued: sendEmail's own
// processImmediately fallback (calls ensureEmailJob directly) and the normal
// path, where the Emails afterChange hook queues the job and has no access to
// SendEmailOptions — sendEmail hands the override across via req.context
// instead. Both are exercised here through the public sendEmail() entry point
// rather than by calling ensureEmailJob directly, since a queueName-only test
// on ensureEmailJob cannot show whether sendEmail (or the hook it relies on)
// ever forwards the caller's option in the first place.

describe('sendEmail options.queue', () => {
  test('processImmediately fallback: forwarded to ensureEmailJob when the create() hook hands back no job id', async () => {
    const queue = vi.fn().mockResolvedValue({ id: 'job-1' })
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const run = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })

    const payload = {
      create,
      find,
      jobs: { queue, run },
      mailing: { collections: { emails: 'emails' } },
    } as never

    await sendEmail(payload, {
      data: { html: '<p>hi</p>', subject: 'Hi', to: ['user@example.com'] },
      processImmediately: true,
      queue: 'priority-queue',
    })

    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'priority-queue' })
    )
  })

  test('normal path: forwarded through req.context to the real Emails afterChange hook', async () => {
    const queue = vi.fn().mockResolvedValue({ id: 'job-1' })
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const afterChangeHook = Emails.hooks!.afterChange![0]

    // Stands in for what Payload itself does inside payload.create(): run the
    // collection's afterChange hooks with the same `context` object the caller
    // passed in, then return the created doc. Using the real hook (imported
    // from the collection, not reimplemented here) is what makes this an
    // end-to-end check of the forwarding path rather than another unit test of
    // ensureEmailJob in isolation.
    const create = vi.fn(async ({ context, data }: { context: unknown, data: Record<string, unknown> }) => {
      const doc = { id: 'email-1', jobs: [], status: 'pending', ...data }
      await afterChangeHook({
        doc,
        operation: 'create',
        previousDoc: undefined,
        req: { context, payload: { find, jobs: { queue } } },
      } as never)
      return doc
    })

    const payload = {
      create,
      find,
      jobs: { queue },
      mailing: { collections: { emails: 'emails' } },
    } as never

    await sendEmail(payload, {
      data: { html: '<p>hi</p>', subject: 'Hi', to: ['user@example.com'] },
      queue: 'priority-queue',
    })

    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'priority-queue' })
    )
  })

  test('normal path: omitting options.queue leaves the hook to fall back to the configured default', async () => {
    const queue = vi.fn().mockResolvedValue({ id: 'job-1' })
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const afterChangeHook = Emails.hooks!.afterChange![0]

    const create = vi.fn(async ({ context, data }: { context: unknown, data: Record<string, unknown> }) => {
      const doc = { id: 'email-1', jobs: [], status: 'pending', ...data }
      await afterChangeHook({
        doc,
        operation: 'create',
        previousDoc: undefined,
        req: { context, payload: { find, jobs: { queue } } },
      } as never)
      return doc
    })

    const payload = {
      create,
      find,
      jobs: { queue },
      mailing: { collections: { emails: 'emails' } },
    } as never

    await sendEmail(payload, {
      data: { html: '<p>hi</p>', subject: 'Hi', to: ['user@example.com'] },
    })

    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'default' })
    )
  })
})
