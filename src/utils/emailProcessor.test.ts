import { describe, expect, test, vi } from 'vitest'

import { processJobById } from './emailProcessor.js'

vi.mock('./logger.js', () => ({
  createContextLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

describe('processJobById', () => {
  test('throws when payload.jobs is not configured', async () => {
    const payload = { jobs: undefined } as never

    await expect(processJobById(payload, '42')).rejects.toThrow(
      'PayloadCMS jobs not configured',
    )
  })

  test('runs the job via payload.jobs.run with a where clause matching the job id', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const payload = { jobs: { run } } as never

    await processJobById(payload, '7')

    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith({
      where: { id: { equals: '7' } },
    })
  })

  test('wraps the error with the job id when payload.jobs.run rejects', async () => {
    const run = vi.fn().mockRejectedValue('adapter timeout')
    const payload = { jobs: { run } } as never

    await expect(processJobById(payload, '99')).rejects.toThrow(
      /Failed to process job 99.*adapter timeout/,
    )
  })

  test('wraps the error with the job id when payload.jobs.run throws', async () => {
    const run = vi.fn().mockImplementation(() => {
      throw new Error('connection refused')
    })
    const payload = { jobs: { run } } as never

    await expect(processJobById(payload, '13')).rejects.toThrow(
      /Failed to process job 13.*connection refused/,
    )
  })
})
