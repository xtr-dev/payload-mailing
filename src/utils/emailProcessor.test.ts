import { describe, expect, test, vi } from 'vitest'

import { processEmailById } from './emailProcessor.js'

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
