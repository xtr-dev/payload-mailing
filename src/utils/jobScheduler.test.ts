import { describe, expect, test, vi } from 'vitest'

import { ensureEmailJob, findExistingJobs } from './jobScheduler.js'

describe('findExistingJobs', () => {
  test('queries payload-jobs by taskSlug (not the invalid "task" field)', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    await findExistingJobs({ find } as never, 1)

    const arg = find.mock.calls[0][0]
    expect(arg.collection).toBe('payload-jobs')
    expect(arg.where).toEqual({ taskSlug: { equals: 'process-email' } })
    // The nested input.emailId path is not filterable on every adapter, so it
    // must NOT appear in the where clause (it is matched in JS instead).
    expect(arg.where).not.toHaveProperty('input.emailId')
    expect(arg.where).not.toHaveProperty('task')
    // The scan must be bounded (newest-first) rather than loading the whole
    // jobs backlog into memory.
    expect(typeof arg.limit).toBe('number')
    expect(arg.limit).toBeLessThanOrEqual(100)
    expect(arg.sort).toBe('-createdAt')
  })

  test('matches the email id against the input JSON in JS', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        { id: 1, input: { emailId: '5' }, taskSlug: 'process-email' },
        { id: 2, input: { emailId: '9' }, taskSlug: 'process-email' },
        { id: 3, input: { emailId: '5' }, taskSlug: 'process-email' },
      ],
    })

    const result = await findExistingJobs({ find } as never, 5)

    expect(result.totalDocs).toBe(2)
    expect(result.docs.map((d) => d.id)).toEqual([1, 3])
  })

  test('normalizes numeric and string ids when matching', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 1, input: { emailId: '42' }, taskSlug: 'process-email' }],
    })

    expect((await findExistingJobs({ find } as never, 42)).totalDocs).toBe(1)
    expect((await findExistingJobs({ find } as never, '42')).totalDocs).toBe(1)
    expect((await findExistingJobs({ find } as never, 7)).totalDocs).toBe(0)
  })
})

describe('ensureEmailJob queue resolution', () => {
  const makePayload = (configQueue?: string) => ({
    find: vi.fn().mockResolvedValue({ docs: [] }),
    jobs: { queue: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    mailing: configQueue ? { config: { queue: configQueue } } : undefined,
  })

  test('a per-call queueName overrides the plugin config queue', async () => {
    const payload = makePayload('plugin-queue')
    await ensureEmailJob(payload as never, 1, { queueName: 'high' })

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'high' })
    )
  })

  test('falls back to the plugin config queue when no queueName is given', async () => {
    const payload = makePayload('plugin-queue')
    await ensureEmailJob(payload as never, 1)

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'plugin-queue' })
    )
  })

  test('falls back to "default" when neither queueName nor config queue is set', async () => {
    const payload = makePayload()
    await ensureEmailJob(payload as never, 1)

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'default' })
    )
  })
})
