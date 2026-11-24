import type { PayloadHandler, PayloadRequest } from 'payload'

import { addDataAndFileToRequest } from 'payload'

import type { BaseEmailTemplateDocument } from '../types/index.js'

import { createContextLogger } from '../utils/logger.js'

interface PreviewRequestBody {
  /** Draft rich-text editor state to render (Lexical state object). */
  content?: unknown
  /** Selected layout name, or the 'default'/'none' sentinels. */
  layout?: string
  /** Draft subject line (may contain template variables). */
  subject?: string
  /** Sample variables used to render the template and subject. */
  variables?: Record<string, unknown>
}

type AccessFn = (args: { req: PayloadRequest }) => unknown

/**
 * Returns true when the request passes the templates collection's `update` or
 * `create` access — the operations an editor needs to work on a template, and
 * therefore to preview one. A query-constraint result (a `Where` object) counts
 * as allowed: the user may edit at least some templates, and the preview only
 * renders the draft they send, not a stored document. The collection's slug is
 * read from the mailing context so renamed collections are respected.
 */
async function canEditTemplates(req: PayloadRequest): Promise<boolean> {
  const mailing = (req.payload as unknown as { mailing?: { collections?: { templates?: string } } }).mailing
  const slug = mailing?.collections?.templates || 'email-templates'
  const collection = (req.payload.collections as Record<string, { config?: { access?: Record<string, unknown> } } | undefined>)[slug]
  const access = collection?.config?.access

  if (!access) {
    return false
  }

  for (const operation of ['update', 'create']) {
    const fn = access[operation]
    if (typeof fn === 'function' && (await (fn as AccessFn)({ req }))) {
      return true
    }
  }
  return false
}

/**
 * Renders a draft template (the unsaved editor content + sample variables) and
 * returns `{ html, subject, text }` for the in-admin preview component. The
 * render goes through the same `MailingService.renderTemplateDocument` pipeline
 * used to send real emails, so the preview honors the configured template engine
 * and the selected layout rather than reimplementing serialization in the browser.
 *
 * Registered as a POST endpoint at `<apiRoute>/mailing/preview-template`.
 */
export const previewTemplateHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  // Previews can render arbitrary template content, so restrict the endpoint to
  // the same audience that can edit templates: a logged-in user who passes the
  // templates collection's own update (or create) access.
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await canEditTemplates(req))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Populate req.data from the JSON request body.
  await addDataAndFileToRequest(req)
  const body = (req.data || {}) as PreviewRequestBody

  const service = (req.payload as unknown as { mailing?: { service?: {
    renderTemplateDocument: (
      template: BaseEmailTemplateDocument,
      variables: Record<string, unknown>,
    ) => Promise<{ html: string; subject: string; text: string }>
  } } }).mailing?.service

  if (!service) {
    return Response.json(
      { error: 'Mailing service not available' },
      { status: 503 },
    )
  }

  // Only `content`, `subject` and `layout` participate in rendering; the other
  // BaseEmailTemplateDocument fields are irrelevant for a preview, so we supply
  // placeholders and cast to the expected shape.
  const draftTemplate = {
    id: 'preview',
    name: 'preview',
    slug: 'preview',
    content: body.content,
    layout: body.layout,
    subject: body.subject || '',
  } as unknown as BaseEmailTemplateDocument

  try {
    const result = await service.renderTemplateDocument(draftTemplate, body.variables || {})
    return Response.json(result)
  } catch (error) {
    const logger = createContextLogger(req.payload, 'PREVIEW')
    logger.error('Template preview render failed:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to render preview' },
      { status: 422 },
    )
  }
}

export default previewTemplateHandler
