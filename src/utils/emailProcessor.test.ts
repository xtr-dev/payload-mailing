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
