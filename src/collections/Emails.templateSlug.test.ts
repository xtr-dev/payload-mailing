import { describe, expect, test, vi } from 'vitest'

import Emails from './Emails.js'

const beforeChange = (Emails.hooks as any).beforeChange[0]

const makeReq = () => {
  const payload: any = {
    findByID: vi.fn().mockResolvedValue({ id: 7, slug: 'welcome' }),
    mailing: { collections: { emails: 'emails', templates: 'email-templates' } },
  }
  return { payload }
}

describe('Emails beforeChange templateSlug', () => {
  test.each([
    ['numeric ID (SQL adapters)', 7],
    ['string ID (MongoDB)', '7'],
    ['populated document', { id: 7, slug: 'welcome' }],
  ])('fills templateSlug from a %s', async (_label, template) => {
    const req = makeReq()

    const data = await beforeChange({ data: { template }, req })

    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: typeof template === 'object' ? 7 : template, collection: 'email-templates' }),
    )
    expect(data.templateSlug).toBe('welcome')
  })
})
