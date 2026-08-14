import { describe, expect, test, vi } from 'vitest'

import { sendEmail } from './sendEmail.js'

const TEMPLATE_SLUG = 'welcome'
const TEMPLATE_ID = 'tpl-1'

const makeTemplateDoc = (overrides: Record<string, any> = {}) => ({
  id: TEMPLATE_ID,
  name: 'Welcome',
  slug: TEMPLATE_SLUG,
  ...overrides,
})

// Builds a payload stub with just enough surface for sendEmail: a `mailing`
// context (so getMailing succeeds), a template lookup (`collections` +
// `find`) that resolves TEMPLATE_SLUG, and a spyable `create`. Individual
// tests override only the pieces they care about.
const makeStubPayload = ({
  create = vi.fn().mockResolvedValue({ id: 'email-1' }),
  find = vi.fn().mockResolvedValue({ docs: [makeTemplateDoc()] }),
  mailing = {},
  renderTemplateDocument = vi.fn().mockResolvedValue({ html: '<p>tpl</p>', subject: 'Tpl', text: 'tpl text' }),
}: {
  create?: any
  find?: any
  mailing?: Record<string, any>
  renderTemplateDocument?: any
} = {}): any => ({
  collections: {
    'email-templates': {},
  },
  create,
  find,
  mailing: {
    collections: { emails: 'emails', templates: 'email-templates' },
    service: { renderTemplateDocument },
    ...mailing,
  },
})

describe('sendEmail -> payload.create', () => {
  test('rejects a missing "to" before anything is written', async () => {
    const create = vi.fn()
    const payload = makeStubPayload({ create })

    await expect(
      sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi' } }),
    ).rejects.toThrow(/Field "to" is required/)
    expect(create).not.toHaveBeenCalled()
  })

  test('a direct send with no subject/html gets the direct-send message', async () => {
    const create = vi.fn()
    const payload = makeStubPayload({ create })

    await expect(
      sendEmail(payload, { data: { to: 'a@example.com' } }),
    ).rejects.toThrow(/required when sending direct emails without a template/)
    expect(create).not.toHaveBeenCalled()
  })

  test('a template send whose render comes back without a subject names the template slug', async () => {
    const create = vi.fn()
    const renderTemplateDocument = vi.fn().mockResolvedValue({ html: '<p>tpl</p>', subject: '', text: '' })
    const payload = makeStubPayload({ create, renderTemplateDocument })

    await expect(
      sendEmail(payload, { data: { to: 'a@example.com' }, template: { slug: TEMPLATE_SLUG } }),
    ).rejects.toThrow(new RegExp(`Template rendering failed.*${TEMPLATE_SLUG}`))
    expect(create).not.toHaveBeenCalled()
  })

  test('template output overrides caller-supplied subject and html', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })
    const renderTemplateDocument = vi.fn().mockResolvedValue({ html: '<p>tpl</p>', subject: 'Tpl', text: 'tpl text' })
    const payload = makeStubPayload({ create, renderTemplateDocument })

    await sendEmail(payload, {
      data: { html: '<p>mine</p>', subject: 'Mine', to: 'a@example.com' },
      template: { slug: TEMPLATE_SLUG },
    })

    const data = create.mock.calls[0][0].data
    expect(data.subject).toBe('Tpl')
    expect(data.html).toBe('<p>tpl</p>')
  })

  test('template bookkeeping (resolved template id, variables) lands on the document', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })
    const payload = makeStubPayload({ create })

    await sendEmail(payload, {
      data: { to: 'a@example.com' },
      template: { slug: TEMPLATE_SLUG, variables: { name: 'Ada' } },
    })

    const data = create.mock.calls[0][0].data
    expect(data.template).toBe(TEMPLATE_ID)
    expect(data.variables).toEqual({ name: 'Ada' })
  })

  test('variables default to {} rather than undefined when the caller passes none', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })
    const payload = makeStubPayload({ create })

    await sendEmail(payload, {
      data: { to: 'a@example.com' },
      template: { slug: TEMPLATE_SLUG },
    })

    expect(create.mock.calls[0][0].data.variables).toEqual({})
  })

  test('Date fields are coerced to ISO strings before create', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })
    const payload = makeStubPayload({ create })
    const date = new Date('2026-01-01T00:00:00Z')

    await sendEmail(payload, {
      data: {
        createdAt: date,
        html: '<p>hi</p>',
        lastAttemptAt: date,
        scheduledAt: date,
        sentAt: date,
        subject: 'Hi',
        to: 'a@example.com',
        updatedAt: date,
      },
    })

    const data = create.mock.calls[0][0].data
    expect(data.scheduledAt).toBe('2026-01-01T00:00:00.000Z')
    expect(data.sentAt).toBe('2026-01-01T00:00:00.000Z')
    expect(data.lastAttemptAt).toBe('2026-01-01T00:00:00.000Z')
    expect(data.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(data.updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  test('a date already given as a string is forwarded unchanged', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'email-1' })
    const payload = makeStubPayload({ create })

    await sendEmail(payload, {
      data: {
        html: '<p>hi</p>',
        scheduledAt: '2026-02-02T00:00:00.000Z',
        subject: 'Hi',
        to: 'a@example.com',
      },
    })

    expect(create.mock.calls[0][0].data.scheduledAt).toBe('2026-02-02T00:00:00.000Z')
  })

  describe('collection slug resolution', () => {
    test('options.collectionSlug wins over the configured collection', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'email-1' })
      const payload = makeStubPayload({
        create,
        mailing: { collections: { emails: 'configured-emails', templates: 'email-templates' } },
      })

      await sendEmail(payload, {
        collectionSlug: 'explicit-emails',
        data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' },
      })

      expect(create.mock.calls[0][0].collection).toBe('explicit-emails')
    })

    test('falls back to mailing.collections.emails when no override is given', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'email-1' })
      const payload = makeStubPayload({
        create,
        mailing: { collections: { emails: 'configured-emails', templates: 'email-templates' } },
      })

      await sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' } })

      expect(create.mock.calls[0][0].collection).toBe('configured-emails')
    })

    test('falls back to "emails" when nothing configures a slug', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'email-1' })
      const payload = makeStubPayload({
        create,
        mailing: { collections: { emails: '', templates: 'email-templates' } },
      })

      await sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' } })

      expect(create.mock.calls[0][0].collection).toBe('emails')
    })
  })

  describe('create-result guard', () => {
    test('rejects when create resolves null', async () => {
      const create = vi.fn().mockResolvedValue(null)
      const payload = makeStubPayload({ create })

      await expect(
        sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' } }),
      ).rejects.toThrow(/Failed to create email: invalid response from database/)
    })

    test('rejects when create resolves an object with no id', async () => {
      const create = vi.fn().mockResolvedValue({})
      const payload = makeStubPayload({ create })

      await expect(
        sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' } }),
      ).rejects.toThrow(/Failed to create email: invalid response from database/)
    })
  })

  test('rejects before create when the plugin is not initialized', async () => {
    const create = vi.fn()
    const payload: any = { create }

    await expect(
      sendEmail(payload, { data: { html: '<p>hi</p>', subject: 'Hi', to: 'a@example.com' } }),
    ).rejects.toThrow(/Mailing plugin not initialized/)
    expect(create).not.toHaveBeenCalled()
  })
})
