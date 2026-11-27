import { describe, expect, test, vi } from 'vitest'

import { MailingService } from './MailingService.js'

describe('processEmails', () => {
  test('selects highest-priority emails first and oldest first within a priority', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const service = new MailingService({ db: {}, email: {}, find } as never, {} as never)

    await service.processEmails()

    // The first query looks for stale `processing` claims, the second for due emails.
    expect(find).toHaveBeenCalledTimes(2)
    expect(find.mock.calls[1][0]).toMatchObject({
      collection: 'emails',
      limit: 50,
      sort: ['priority', 'createdAt'],
    })
  })

  test('releases a stale processing claim as a failed attempt and leaves fresh claims alone', async () => {
    const stale = { id: 'stale', attempts: 1, status: 'processing' }
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [stale] })
      .mockResolvedValue({ docs: [] })
    const update = vi.fn().mockResolvedValue({ docs: [stale] })
    const service = new MailingService(
      { db: {}, email: {}, find, update } as never,
      { processingTimeout: 60000, retryAttempts: 3 } as never,
    )

    const before = Date.now()
    await service.processEmails()

    const staleQuery = JSON.stringify(find.mock.calls[0][0].where)
    expect(staleQuery).toContain('"processing"')
    const threshold = Date.parse(JSON.stringify(find.mock.calls[0][0].where).match(/"less_than_equal":"([^"]+)"/)![1])
    expect(threshold).toBeLessThanOrEqual(before - 60000 + 1000)
    expect(threshold).toBeGreaterThanOrEqual(before - 60000 - 1000)

    expect(update).toHaveBeenCalledOnce()
    const release = update.mock.calls[0][0]
    expect(release.data).toMatchObject({ attempts: 2, status: 'pending' })
    // The release is guarded on the row still being stale, so a concurrent
    // recovery or a send that just finished is not overwritten.
    expect(JSON.stringify(release.where)).toContain('"processing"')
    expect(JSON.stringify(release.where)).toContain('"stale"')
  })
})
