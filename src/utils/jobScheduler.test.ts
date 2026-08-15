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

describe('ensureEmailJob', () => {
  test('queues a new job when the pre-check finds nothing', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const queue = vi.fn().mockResolvedValue({ id: 123 })
    const payload = { find, jobs: { queue } } as never

    const result = await ensureEmailJob(payload, 5)

    expect(queue).toHaveBeenCalledTimes(1)
    expect(queue).toHaveBeenCalledWith({
      input: { emailId: '5' },
      queue: 'default',
      task: 'process-email',
      waitUntil: undefined,
    })
    expect(result).toEqual({ created: true, jobIds: [123] })
  })

  describe('queue name resolution', () => {
    test('uses payload.mailing.config.queue when options.queueName is not given', async () => {
      const find = vi.fn().mockResolvedValue({ docs: [] })
      const queue = vi.fn().mockResolvedValue({ id: 1 })
      const payload = {
        find,
        jobs: { queue },
        mailing: { config: { queue: 'emails-queue' } },
      } as never

      await ensureEmailJob(payload, 1)

      expect(queue.mock.calls[0][0].queue).toBe('emails-queue')
    })

    test('falls back to "default" when neither options.queueName nor payload.mailing.config.queue is set', async () => {
      const find = vi.fn().mockResolvedValue({ docs: [] })
      const queue = vi.fn().mockResolvedValue({ id: 1 })
      const payload = { find, jobs: { queue } } as never

      await ensureEmailJob(payload, 1)

      expect(queue.mock.calls[0][0].queue).toBe('default')
    })

    test('options.queueName wins over both payload.mailing.config.queue and the default', async () => {
      const find = vi.fn().mockResolvedValue({ docs: [] })
      const queue = vi.fn().mockResolvedValue({ id: 1 })
      const payload = {
        find,
        jobs: { queue },
        mailing: { config: { queue: 'emails-queue' } },
      } as never

      await ensureEmailJob(payload, 1, { queueName: 'priority-queue' })

      expect(queue.mock.calls[0][0].queue).toBe('priority-queue')
    })
  })

  test('returns the pre-existing job without queueing a new one when the pre-check finds a match', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 7, input: { emailId: '5' }, taskSlug: 'process-email' }],
    })
    const queue = vi.fn()
    const payload = { find, jobs: { queue } } as never

    const result = await ensureEmailJob(payload, 5)

    expect(queue).not.toHaveBeenCalled()
    expect(result).toEqual({ created: false, jobIds: [7] })
  })

  test('swallows a queue() error and returns the job a concurrent caller created in the meantime', async () => {
    const find = vi
      .fn()
      // pre-check, before queue(): nothing found yet
      .mockResolvedValueOnce({ docs: [] })
      // re-check after queue() throws: a concurrent call won the race
      .mockResolvedValueOnce({
        docs: [{ id: 9, input: { emailId: '5' }, taskSlug: 'process-email' }],
      })
    const queue = vi.fn().mockRejectedValue(new Error('unique constraint violation'))
    const payload = { find, jobs: { queue } } as never

    const result = await ensureEmailJob(payload, 5)

    expect(queue).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ created: false, jobIds: [9] })
  })

  test('propagates the error when queue() fails and the race re-check also finds nothing', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const queue = vi.fn().mockRejectedValue(new Error('db unavailable'))
    const payload = { find, jobs: { queue } } as never

    const promise = ensureEmailJob(payload, 5)

    await expect(promise).rejects.toThrow('Failed to create job for email 5')
    await expect(promise).rejects.toThrow('db unavailable')
  })

  test('throws synchronously, without querying or queueing, when payload.jobs is not configured', async () => {
    const find = vi.fn()
    const payload = { find } as never

    await expect(ensureEmailJob(payload, 5)).rejects.toThrow(
      'PayloadCMS jobs not configured - cannot create email job'
    )
    expect(find).not.toHaveBeenCalled()
  })
})
