import type { PayloadRequest } from 'payload'

import { describe, expect, test, vi } from 'vitest'

// The handler parses the JSON body with Payload's helper; the stub request
// already carries `data`, so the helper is replaced with a no-op.
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  addDataAndFileToRequest: vi.fn(() => Promise.resolve()),
}))

const { previewTemplateHandler } = await import('./previewTemplate.js')

const render = vi.fn(() => Promise.resolve({ html: '<p>x</p>', subject: 's', text: 'x' }))

// Payload's logger API as used by createContextLogger (child() + level methods).
const stubLogger = { child: () => stubLogger, error: vi.fn(), info: vi.fn(), warn: vi.fn() }

const makeReq = (opts: {
  access?: Record<string, (args: { req: PayloadRequest }) => unknown>
  templatesSlug?: string
  user?: unknown
}) => {
  const slug = opts.templatesSlug || 'email-templates'
  return {
    data: { content: {}, subject: 's', variables: {} },
    payload: {
      collections: { [slug]: { config: { access: opts.access || {} } } },
      logger: stubLogger,
      mailing: { collections: { templates: slug }, service: { renderTemplateDocument: render } },
    },
    user: opts.user,
  } as unknown as PayloadRequest
}

describe('previewTemplateHandler access', () => {
  test('rejects anonymous requests with 401', async () => {
    const res = await previewTemplateHandler(makeReq({ access: { update: () => true } }))
    expect(res.status).toBe(401)
  })

  test('rejects a logged-in user without template update/create access with 403', async () => {
    const res = await previewTemplateHandler(
      makeReq({ access: { create: () => false, update: () => false }, user: { id: 1 } }),
    )
    expect(res.status).toBe(403)
    expect(render).not.toHaveBeenCalled()
  })

  test('allows a user who passes the templates update access', async () => {
    const update = vi.fn(({ req }: { req: PayloadRequest }) => (req.user as { role?: string })?.role === 'admin')
    const res = await previewTemplateHandler(
      makeReq({ access: { create: () => false, update }, user: { id: 1, role: 'admin' } }),
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalled()
    expect(await res.json()).toEqual({ html: '<p>x</p>', subject: 's', text: 'x' })
  })

  test('treats a query-constraint (Where) access result as allowed', async () => {
    const res = await previewTemplateHandler(
      makeReq({ access: { update: () => ({ owner: { equals: 1 } }) }, user: { id: 1 } }),
    )
    expect(res.status).toBe(200)
  })

  test('checks the access of a renamed templates collection', async () => {
    const res = await previewTemplateHandler(
      makeReq({ access: { create: () => Promise.resolve(true) }, templatesSlug: 'my-templates', user: { id: 1 } }),
    )
    expect(res.status).toBe(200)
  })

  test('answers 403 when the access function throws', async () => {
    const res = await previewTemplateHandler(
      makeReq({
        access: {
          update: () => {
            throw new Error('access blew up')
          },
        },
        user: { id: 1 },
      }),
    )
    expect(res.status).toBe(403)
  })
})
