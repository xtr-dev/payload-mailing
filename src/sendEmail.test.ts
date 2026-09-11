import { describe, expect, test, vi } from 'vitest'

import { sendEmail } from './sendEmail.js'

vi.mock('./utils/emailProcessor.js', () => ({
  processJobById: vi.fn(),
}))

vi.mock('./utils/jobScheduler.js', () => ({
  ensureEmailJob: vi.fn(),
}))

const makePayload = () => {
  const create = vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'email-1', ...data }))

  return {
    collections: { 'email-templates': {} },
    create,
    find: vi.fn(),
    jobs: { run: vi.fn() },
    mailing: {
      collections: { emails: 'emails', templates: 'email-templates' },
      service: { renderTemplateDocument: vi.fn() },
    },
  }
}

describe('sendEmail', () => {
  test.each([
    { to: ' , ' },
    { to: ',,,' },
    { to: [] },
  ])('rejects a $to recipient string/array that normalizes to zero addresses', async ({ to }) => {
    const payload = makePayload()

    await expect(sendEmail(payload as never, {
      data: { html: '<p>x</p>', subject: 'x', to },
    } as never)).rejects.toThrow('Field "to" is required for sending emails')
    expect(payload.create).not.toHaveBeenCalled()
  })
})
