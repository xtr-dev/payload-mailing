import { describe, expect, test, vi } from 'vitest'

import { MailingService } from '../services/MailingService.js'
import { renderTemplate } from './helpers.js'

describe('renderTemplate', () => {
  test('rejects an unknown template slug after its lookup returns no documents', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const payload = {
      db: {},
      email: {},
      find,
    } as any

    payload.mailing = {
      collections: { emails: 'emails', templates: 'email-templates' },
      config: {},
      service: new MailingService(payload, {}),
    }

    await expect(renderTemplate(payload, 'does-not-exist', {})).rejects.toThrow(
      'Email template not found: does-not-exist',
    )
    expect(find).toHaveBeenCalledWith({
      collection: 'email-templates',
      limit: 1,
      where: { slug: { equals: 'does-not-exist' } },
    })
  })
})
