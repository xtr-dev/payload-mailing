import { describe, expect, test, vi } from 'vitest'

import { processJobById } from './emailProcessor.js'

describe('processJobById', () => {
  test('runs the job regardless of which queue it was placed on', async () => {
    const payload: any = { jobs: { run: vi.fn().mockResolvedValue(undefined) } }

    await processJobById(payload, 'job-1')

    // Without allQueues, payload.jobs.run only considers the `default` queue,
    // so a job on any other queue would silently never run.
    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: 'job-1' } },
    })
  })
})
