import { describe, expect, test, vi } from 'vitest'

import { MailingService } from './MailingService.js'

describe('processEmails', () => {
  test('selects highest-priority emails first and oldest first within a priority', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const service = new MailingService({ db: {}, email: {}, find } as never, {} as never)

    await service.processEmails()

    expect(find).toHaveBeenCalledOnce()
    expect(find.mock.calls[0][0]).toMatchObject({
      collection: 'emails',
      limit: 50,
      sort: 'priority,createdAt',
    })
  })
})
