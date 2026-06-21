import { describe, expect, test, vi } from 'vitest'

import { findExistingJobs } from './jobScheduler.js'

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
