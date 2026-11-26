import { describe, expect, test, vi } from 'vitest'

import { processAllEmails, processEmailById, processJobById } from './emailProcessor.js'

vi.mock('./logger.js', () => ({
  createContextLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

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

  test('throws when payload.jobs is not configured', async () => {
    const payload = { jobs: undefined } as never

    await expect(processJobById(payload, '42')).rejects.toThrow(
      'PayloadCMS jobs not configured',
    )
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

describe('processEmailById', () => {
  test('throws when the mailing plugin is not on the payload instance', async () => {
    const payload = {} as never

    await expect(processEmailById(payload, '1')).rejects.toThrow(
      'Mailing plugin not found on payload instance',
    )
  })

  test('throws when the mailing service has not finished initializing', async () => {
    const payload = { mailing: {} } as never

    await expect(processEmailById(payload, '1')).rejects.toThrow(
      'Mailing service not available',
    )
  })

  test('delegates to mailingContext.service.processEmailItem with the email id', async () => {
    const processEmailItem = vi.fn().mockResolvedValue(undefined)
    const payload = { mailing: { service: { processEmailItem } } } as never

    await processEmailById(payload, '42')

    expect(processEmailItem).toHaveBeenCalledOnce()
    expect(processEmailItem).toHaveBeenCalledWith('42')
  })
})

describe('processAllEmails', () => {
  test('does not call retryFailedEmails when processEmails rejects', async () => {
    const processEmails = vi.fn().mockRejectedValue(new Error('queue read failed'))
    const retryFailedEmails = vi.fn().mockResolvedValue(undefined)
    const payload = { mailing: { service: { processEmails, retryFailedEmails } } } as never

    await expect(processAllEmails(payload)).rejects.toThrow('queue read failed')

    expect(processEmails).toHaveBeenCalledOnce()
    expect(retryFailedEmails).not.toHaveBeenCalled()
  })

  test('calls processEmails before retryFailedEmails on the success path', async () => {
    const calls: string[] = []
    const processEmails = vi.fn().mockImplementation(async () => {
      // The delay makes a Promise.all([processEmails(), retryFailedEmails()])
      // regression observable: without a real gap both mocks push synchronously
      // and preserve source order whether or not the caller awaits between them.
      await new Promise((resolve) => setTimeout(resolve, 10))
      calls.push('processEmails')
    })
    const retryFailedEmails = vi.fn().mockImplementation(() => {
      calls.push('retryFailedEmails')
      return Promise.resolve()
    })
    const payload = { mailing: { service: { processEmails, retryFailedEmails } } } as never

    await processAllEmails(payload)

    expect(calls).toEqual(['processEmails', 'retryFailedEmails'])
  })
})
