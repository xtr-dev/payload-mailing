import { describe, expect, test, vi } from 'vitest'

import {
  ensureEmailJob,
  findExistingJobs,
  updateEmailJobRelationship,
} from './jobScheduler.js'

function createPayload(options?: {
  find?: ReturnType<typeof vi.fn>
  queue?: ReturnType<typeof vi.fn>
  queueName?: string
}) {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }

  return {
    find: options?.find ?? vi.fn().mockResolvedValue({ docs: [] }),
    jobs: {
      queue: options?.queue ?? vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    logger: {
      child: vi.fn().mockReturnValue(logger),
    },
    mailing: options?.queueName
      ? { config: { queue: options.queueName } }
      : undefined,
  }
}

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
  test('returns existing jobs without queueing a duplicate', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        { id: 'job-1', input: { emailId: '42' } },
        { id: 2, input: { emailId: 42 } },
      ],
    })
    const payload = createPayload({ find })

    await expect(ensureEmailJob(payload as never, 42)).resolves.toEqual({
      created: false,
      jobIds: ['job-1', 2],
    })
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  test('queues one process-email job with a string email id', async () => {
    const payload = createPayload()

    await expect(ensureEmailJob(payload as never, 42)).resolves.toEqual({
      created: true,
      jobIds: ['job-1'],
    })
    expect(payload.jobs.queue).toHaveBeenCalledOnce()
    expect(payload.jobs.queue).toHaveBeenCalledWith({
      input: { emailId: '42' },
      queue: 'default',
      task: 'process-email',
      waitUntil: undefined,
    })
  })

  test.each([
    { configured: 'configured', expected: 'explicit', option: 'explicit' },
    { configured: 'configured', expected: 'configured', option: undefined },
    { configured: undefined, expected: 'default', option: undefined },
  ])('uses queue precedence for $expected', async ({ configured, expected, option }) => {
    const payload = createPayload({ queueName: configured })

    await ensureEmailJob(payload as never, 'email-1', { queueName: option })

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: expected })
    )
  })

  test('converts scheduledAt to waitUntil and leaves an omitted value undefined', async () => {
    const scheduledPayload = createPayload()
    const unscheduledPayload = createPayload()

    await ensureEmailJob(scheduledPayload as never, 1, {
      scheduledAt: '2026-01-01T00:00:00Z',
    })
    await ensureEmailJob(unscheduledPayload as never, 2)

    expect(scheduledPayload.jobs.queue.mock.calls[0][0].waitUntil).toEqual(
      new Date('2026-01-01T00:00:00Z')
    )
    expect(unscheduledPayload.jobs.queue.mock.calls[0][0].waitUntil).toBeUndefined()
  })

  test('returns a concurrently created job when queueing fails', async () => {
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 'racing-job', input: { emailId: '7' } }] })
    const queue = vi.fn().mockRejectedValue(new Error('unique conflict'))
    const payload = createPayload({ find, queue })

    await expect(ensureEmailJob(payload as never, 7)).resolves.toEqual({
      created: false,
      jobIds: ['racing-job'],
    })
    expect(find).toHaveBeenCalledTimes(2)
  })

  test('reports the original queue error when the retry finds no job', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const queue = vi.fn().mockRejectedValue(new Error('queue unavailable'))
    const payload = createPayload({ find, queue })

    await expect(ensureEmailJob(payload as never, 9)).rejects.toThrow(
      'Failed to create job for email 9: Error: queue unavailable'
    )
    expect(find).toHaveBeenCalledTimes(2)
  })

  test('fails before querying when Payload jobs are not configured', async () => {
    const find = vi.fn()
    const payload = { find }

    await expect(ensureEmailJob(payload as never, 11)).rejects.toThrow(
      'PayloadCMS jobs not configured'
    )
    expect(find).not.toHaveBeenCalled()
  })
})

describe('updateEmailJobRelationship', () => {
  test('normalizes populated and scalar job ids while preserving existing jobs', async () => {
    const findByID = vi.fn().mockResolvedValue({ jobs: [{ id: 1 }, '2'] })
    const update = vi.fn().mockResolvedValue({})

    await updateEmailJobRelationship(
      { findByID, update } as never,
      'email-1',
      [2, 3]
    )

    expect(update).toHaveBeenCalledWith({
      id: 'email-1',
      collection: 'emails',
      data: { jobs: ['1', '2', '3'] },
    })
  })
})
