import { describe, expect, test, vi } from 'vitest'

import { processAllEmails } from './emailProcessor.js'

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
      // Delay needed so a Promise.all([processEmails(), retryFailedEmails()])
      // regression would let retryFailedEmails's push land first; without a
      // real gap both mocks push synchronously and preserve source order
      // regardless of whether the caller awaits between them.
      await new Promise((resolve) => setTimeout(resolve, 10))
      calls.push('processEmails')
    })
    const retryFailedEmails = vi.fn().mockImplementation(async () => {
      calls.push('retryFailedEmails')
    })
    const payload = { mailing: { service: { processEmails, retryFailedEmails } } } as never

    await processAllEmails(payload)

    expect(calls).toEqual(['processEmails', 'retryFailedEmails'])
  })
})
