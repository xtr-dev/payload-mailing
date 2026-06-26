import type { Liquid } from 'liquidjs'
import type {CollectionSlug, Payload, SendEmailOptions} from 'payload';

import { EmailAdapter} from 'payload'

import type {
  BaseEmailDocument,
  BaseEmailTemplateDocument,
  EmailLayout,
  MailingService as IMailingService,
  MailingPluginConfig, TemplateVariables
} from '../types/index.js'
import type { MustacheModule, TemplateEngineAdapter } from './templateEngines.js'

import { sanitizeDisplayName } from '../utils/helpers.js'
import { createContextLogger } from '../utils/logger.js'
import { serializeRichTextToHTML, serializeRichTextToText } from '../utils/richTextSerializer.js'
import {
  CustomRendererAdapter,
  LiquidEngineAdapter,
  MustacheEngineAdapter,
  SimpleEngineAdapter,
} from './templateEngines.js'

export class MailingService implements IMailingService {
  private config: MailingPluginConfig
  // Lazily-built engine adapters, cached after first use. `simpleAdapter` has no
  // dependencies to load and doubles as the fallback when an optional engine
  // package is missing or a render throws.
  private customAdapter: null | TemplateEngineAdapter = null
  private emailsCollection: string
  private liquid: false | Liquid | null = null
  private liquidAdapter: null | TemplateEngineAdapter = null
  // Separate engine with auto HTML-escaping enabled, used when substituting
  // variables into the HTML body so untrusted values cannot inject markup.
  private liquidEscaped: false | Liquid | null = null
  // Shared in-flight promise for LiquidJS initialization. Concurrent first
  // callers await this single promise so the dynamic `import('liquidjs')` and
  // engine construction run exactly once, even when several emails render
  // before initialization completes.
  private liquidInitPromise: null | Promise<void> = null
  private logger: ReturnType<typeof createContextLogger>
  private mustacheAdapter: null | TemplateEngineAdapter = null
  private mustacheModule: false | MustacheModule | null = null
  private readonly simpleAdapter: TemplateEngineAdapter = new SimpleEngineAdapter()
  private templatesCollection: string
  public payload: Payload

  constructor(payload: Payload, config: MailingPluginConfig) {
    this.payload = payload
    this.config = config

    const templatesConfig = config.collections?.templates
    this.templatesCollection = typeof templatesConfig === 'string' ? templatesConfig : 'email-templates'

    const emailsConfig = config.collections?.emails
    this.emailsCollection = typeof emailsConfig === 'string' ? emailsConfig : 'emails'

    this.logger = createContextLogger(payload, 'MAILING')

    // Use Payload's configured email adapter
    if (!this.payload.email) {
      throw new Error('Payload email configuration is required. Please configure email in your Payload config.')
    }
  }

  /**
   * Atomically claim an email for processing by transitioning it out of
   * `expectedStatus` into `processing`.
   *
   * The candidate `find` in processEmails/retryFailedEmails and this status
   * update are separate steps, so two concurrent runs (e.g. an overlapping
   * cron tick and a per-email job) can both select the same row. To prevent
   * double-sending we guard the transition on the row's *current* status:
   * the bulk `update` only matches the row while it is still in
   * `expectedStatus`, so exactly one run can move it to `processing`. The
   * loser's `where` matches nothing and `docs` comes back empty, letting us
   * detect that we did not win the claim and skip the row.
   *
   * @returns `true` if this run won the claim, `false` if another run already
   *   claimed it (or the row no longer matches `expectedStatus`).
   */
  private async claimEmail(emailId: string, expectedStatus: 'failed' | 'pending'): Promise<boolean> {
    const { docs } = await this.payload.update({
      collection: this.emailsCollection,
      data: {
        lastAttemptAt: new Date().toISOString(),
        status: 'processing',
      },
      where: {
        and: [
          {
            id: {
              equals: emailId,
            },
          },
          {
            status: {
              equals: expectedStatus,
            },
          },
        ],
      },
    })

    // A non-empty `docs` means this run's guarded update matched and moved the
    // row; an empty `docs` means another run already claimed it first.
    return docs.length > 0
  }

  private ensureInitialized(): void {
    if (!this.payload || !this.payload.db) {
      throw new Error('MailingService payload not properly initialized')
    }
    if (!this.payload.email) {
      throw new Error('Email adapter not configured. Please ensure Payload has email configured.')
    }
  }

  private async ensureLiquidJSInitialized(): Promise<void> {
    if (this.liquid !== null) {return} // Already initialized or failed

    // Cache the initialization promise so concurrent first callers all await
    // the same run instead of each importing liquidjs and constructing their
    // own engines (the last writer would otherwise win and the others' engines
    // would be discarded mid-render).
    if (!this.liquidInitPromise) {
      this.liquidInitPromise = this.initializeLiquidJS()
    }

    await this.liquidInitPromise
  }

  /**
   * Formats an email address with optional display name
   */
  private formatEmailAddress(email: string, displayName?: null | string): string {
    if (displayName && displayName.trim()) {
      const sanitizedName = this.sanitizeDisplayName(displayName)
      return `"${sanitizedName}" <${email}>`
    }
    return email
  }

  private getDefaultFrom(): string {
    const fromEmail = this.config.defaultFrom
    const fromName = this.config.defaultFromName

    // Check if fromName exists, is not empty after trimming, and fromEmail exists
    if (fromName && fromName.trim() && fromEmail) {
      return this.formatEmailAddress(fromEmail, fromName)
    }

    return fromEmail || ''
  }

  /**
   * Selects (and caches) the template engine adapter for the configured engine.
   * A custom `templateRenderer` hook takes precedence over the built-in engines.
   * When an optional engine package is missing, the simple replacer is used as a
   * fallback, preserving the behaviour from before engines were adapter-based.
   */
  private async getEngineAdapter(): Promise<TemplateEngineAdapter> {
    if (this.config.templateRenderer) {
      if (!this.customAdapter) {
        this.customAdapter = new CustomRendererAdapter(
          this.config.templateRenderer,
          (message, error) => this.logger.error(message, error),
        )
      }
      return this.customAdapter
    }

    const engine = this.config.templateEngine || 'liquidjs'

    if (engine === 'liquidjs') {
      await this.ensureLiquidJSInitialized()
      if (this.liquid && this.liquidEscaped) {
        if (!this.liquidAdapter) {
          this.liquidAdapter = new LiquidEngineAdapter(
            this.liquid,
            this.liquidEscaped,
            this.simpleAdapter,
            (message, error) => this.logger.error(message, error),
          )
        }
        return this.liquidAdapter
      }
      // LiquidJS failed to load; fall back to the simple replacer.
      return this.simpleAdapter
    }

    if (engine === 'mustache') {
      const mustache = await this.loadMustache()
      if (mustache) {
        if (!this.mustacheAdapter) {
          this.mustacheAdapter = new MustacheEngineAdapter(
            mustache,
            this.simpleAdapter,
            (message, error) => this.logger.error(message, error),
          )
        }
        return this.mustacheAdapter
      }
      // Mustache failed to load; fall back to the simple replacer.
      return this.simpleAdapter
    }

    return this.simpleAdapter
  }

  private async getTemplateBySlug(templateSlug: string): Promise<BaseEmailTemplateDocument | null> {
    let docs
    try {
      ;({ docs } = await this.payload.find({
        collection: this.templatesCollection as any,
        limit: 1,
        where: {
          slug: {
            equals: templateSlug,
          },
        },
      }))
    } catch (error) {
      // A query failure (e.g. DB connectivity) is a genuine error, not a
      // missing template. Log and rethrow so callers can surface it instead of
      // silently treating it as "template not found".
      this.logger.error(`Failed to query template with slug '${templateSlug}':`, error)
      throw error
    }

    return docs.length > 0 ? docs[0] as BaseEmailTemplateDocument : null
  }

  private async incrementAttempts(emailId: string): Promise<number> {
    const email = await this.payload.findByID({
      id: emailId,
      collection: this.emailsCollection,
    })

    const newAttempts = ((email as any).attempts || 0) + 1

    await this.payload.update({
      id: emailId,
      collection: this.emailsCollection,
      data: {
        attempts: newAttempts,
      },
    })

    return newAttempts
  }

  /**
   * Performs the one-time LiquidJS engine setup. Invoked through the cached
   * `liquidInitPromise` so the dynamic import and engine construction never run
   * concurrently.
   */
  private async initializeLiquidJS(): Promise<void> {
    try {
      const liquidModule = await import('liquidjs')
      const { Liquid: LiquidEngine } = liquidModule

      // Two engines share identical filters but differ in output handling:
      // `liquid` emits variable output verbatim (correct for plain-text bodies
      // and subjects), while `liquidEscaped` HTML-escapes every `{{ output }}`
      // so untrusted variables cannot inject markup into the HTML body. Authors
      // opt back into raw HTML per-variable with the `| raw` filter.
      this.liquid = new LiquidEngine()
      this.liquidEscaped = new LiquidEngine({ outputEscape: 'escape' })

      this.registerLiquidFilters(this.liquid)
      this.registerLiquidFilters(this.liquidEscaped)
    } catch (error) {
      this.logger.warn('LiquidJS not available. Falling back to simple variable replacement. Install liquidjs or use a different templateEngine.', error)
      // Mark both as failed to avoid retries.
      this.liquid = false
      this.liquidEscaped = false
    }
  }

  /**
   * Dynamically imports the optional `mustache` package, caching the result.
   * Returns `null` (and warns once) when the package is not installed.
   */
  private async loadMustache(): Promise<MustacheModule | null> {
    if (this.mustacheModule !== null) {
      return this.mustacheModule || null
    }
    try {
      const mustacheModule = await import('mustache')
      this.mustacheModule = (mustacheModule.default || mustacheModule) as MustacheModule
      return this.mustacheModule
    } catch (error) {
      this.logger.warn('Mustache not available. Falling back to simple variable replacement. Install mustache package.', error)
      this.mustacheModule = false
      return null
    }
  }

  /**
   * Registers the built-in template filters (equivalent to Handlebars helpers)
   * on a LiquidJS engine instance.
   */
  private registerLiquidFilters(engine: Liquid): void {
    engine.registerFilter('formatDate', (date: any, format?: string) => {
      if (!date) {return ''}
      const d = new Date(date)
      if (format === 'short') {
        return d.toLocaleDateString()
      }
      if (format === 'long') {
        return d.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }
      return d.toLocaleString()
    })

    engine.registerFilter('formatCurrency', (amount: any, currency = 'USD') => {
      if (typeof amount !== 'number') {return amount}
      return new Intl.NumberFormat('en-US', {
        currency,
        style: 'currency'
      }).format(amount)
    })

    engine.registerFilter('capitalize', (str: any) => {
      if (typeof str !== 'string') {return str}
      return str.charAt(0).toUpperCase() + str.slice(1)
    })
  }

  private async renderEmailTemplate(template: BaseEmailTemplateDocument, variables: Record<string, any> = {}): Promise<{ html: string; text: string }> {
    if (!template.content) {
      return { html: '', text: '' }
    }

    const adapter = await this.getEngineAdapter()

    // Serialize richtext to HTML and text
    let html = serializeRichTextToHTML(template.content)
    let text = serializeRichTextToText(template.content)

    // Apply template variables to the rendered content. Only the HTML body
    // escapes substituted values — the plain-text body must keep characters
    // like `&` verbatim, otherwise recipients see literal entities (`&amp;`).
    html = await adapter.renderHtml(html, variables)
    text = await adapter.render(text, variables)

    // Wrap the rendered body in the resolved layout, if any. The body is the
    // `content` slot and is injected verbatim — it was already escaped during
    // its own render pass — while the layout's own variables are HTML-escaped
    // (HTML layout) or emitted verbatim (text layout). Each engine adapter
    // applies that split according to its own escaping model.
    const layout = this.resolveLayout(template)
    if (layout) {
      html = await adapter.composeLayout(layout.html, html, variables, true)

      // Only wrap plain text when the layout defines a text variant; otherwise
      // keep the unwrapped body so the text/MIME alternative matches today's output.
      if (layout.text) {
        text = await adapter.composeLayout(layout.text, text, variables, false)
      }
    }

    return { html, text }
  }

  /**
   * Resolves which configured layout (if any) applies to a template.
   *
   * Precedence: the template's own `layout` field wins, falling back to the
   * plugin's `defaultLayout` when the template leaves it at "default"/unset.
   * The "none" value explicitly opts out, even when a `defaultLayout` exists.
   * Returns `null` when no layout applies, in which case the body renders
   * exactly as it did before layouts existed (full back-compat).
   */
  private resolveLayout(template: BaseEmailTemplateDocument): EmailLayout | null {
    const layouts = this.config.layouts
    if (!layouts) {
      return null
    }

    const templateChoice = template.layout

    // 'none' is an explicit opt-out that overrides any configured defaultLayout.
    if (templateChoice === 'none') {
      return null
    }

    // A named choice other than the "use default" sentinel selects directly;
    // anything else (the 'default' sentinel, null, undefined) defers to
    // defaultLayout.
    const layoutName =
      templateChoice && templateChoice !== 'default' ? templateChoice : this.config.defaultLayout

    if (!layoutName) {
      return null
    }

    const layout = layouts[layoutName]
    if (!layout) {
      this.logger.warn(`Email layout '${layoutName}' is not configured. Sending without a layout.`)
      return null
    }

    return layout
  }

  /**
   * Sanitizes a display name for use in email headers to prevent header injection
   * Uses the centralized sanitization utility with quote escaping for headers
   */
  private sanitizeDisplayName(name: string): string {
    return sanitizeDisplayName(name, true) // escapeQuotes = true for email headers
  }

  async processEmailItem(emailId: string, expectedStatus: 'failed' | 'pending' = 'pending'): Promise<void> {
    // Win the atomic claim before doing any work; if a concurrent run already
    // claimed this row, skip it so the email is never sent twice.
    const claimed = await this.claimEmail(emailId, expectedStatus)
    if (!claimed) {
      return
    }

    try {
      const email = await this.payload.findByID({
        id: emailId,
        collection: this.emailsCollection,
        depth: 1,
      }) as BaseEmailDocument

      // Combine from and fromName for nodemailer using proper sanitization
      let fromField: string
      if (email.from) {
        fromField = this.formatEmailAddress(email.from, email.fromName)
      } else {
        fromField = this.getDefaultFrom()
      }

      let mailOptions: SendEmailOptions = {
        bcc: email.bcc || undefined,
        cc: email.cc || undefined,
        from: fromField,
        html: email.html,
        replyTo: email.replyTo || undefined,
        subject: email.subject,
        text: email.text || undefined,
        to: email.to,
      }

      if (!mailOptions.from) {
        throw new Error('Email from field is required')
      }
      if (!mailOptions.to || (Array.isArray(mailOptions.to) && mailOptions.to.length === 0)) {
        throw new Error('Email to field is required')
      }
      if (!mailOptions.subject) {
        throw new Error('Email subject is required')
      }
      if (!mailOptions.html && !mailOptions.text) {
        throw new Error('Email content is required')
      }

      // Call beforeSend hook if configured
      if (this.config.beforeSend) {
        try {
          mailOptions = await this.config.beforeSend(mailOptions, email)

          // Validate required properties remain intact after hook execution
          if (!mailOptions.from) {
            throw new Error('beforeSend hook must not remove the "from" property')
          }
          if (!mailOptions.to || (Array.isArray(mailOptions.to) && mailOptions.to.length === 0)) {
            throw new Error('beforeSend hook must not remove or empty the "to" property')
          }
          if (!mailOptions.subject) {
            throw new Error('beforeSend hook must not remove the "subject" property')
          }
          if (!mailOptions.html && !mailOptions.text) {
            throw new Error('beforeSend hook must not remove both "html" and "text" properties')
          }
        } catch (error) {
          this.logger.error('Error in beforeSend hook:', error)
          throw new Error(`beforeSend hook failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Send email using Payload's email adapter
      await this.payload.email.sendEmail(mailOptions)

      await this.payload.update({
        id: emailId,
        collection: this.emailsCollection,
        data: {
          error: null,
          sentAt: new Date().toISOString(),
          status: 'sent',
        },
      })

    } catch (error) {
      const attempts = await this.incrementAttempts(emailId)
      const maxAttempts = this.config.retryAttempts || 3

      await this.payload.update({
        id: emailId,
        collection: this.emailsCollection,
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          lastAttemptAt: new Date().toISOString(),
          status: attempts >= maxAttempts ? 'failed' : 'pending',
        },
      })

      if (attempts >= maxAttempts) {
        this.logger.error(`Email ${emailId} failed permanently after ${attempts} attempts:`, error)
      }
    }
  }

  async processEmails(): Promise<void> {
    this.ensureInitialized()
    const currentTime = new Date().toISOString()

    // Each invocation processes at most 50 due-pending emails (highest priority,
    // oldest first). This bounds the work and memory of a single run; a backlog
    // larger than the cap is drained across successive calls. Drive repeated
    // calls from a scheduled job to keep a large queue moving.
    const { docs: pendingEmails } = await this.payload.find({
      collection: this.emailsCollection,
      limit: 50,
      sort: 'priority,-createdAt',
      where: {
        and: [
          {
            status: {
              equals: 'pending',
            },
          },
          {
            or: [
              {
                scheduledAt: {
                  exists: false,
                },
              },
              {
                scheduledAt: {
                  less_than_equal: currentTime,
                },
              },
            ],
          },
        ],
      },
    })

    for (const email of pendingEmails) {
      await this.processEmailItem(String(email.id), 'pending')
    }
  }

  async renderTemplate(templateSlug: string, variables: TemplateVariables): Promise<{ html: string; subject: string; text: string }> {
    this.ensureInitialized()
    const template = await this.getTemplateBySlug(templateSlug)

    if (!template) {
      throw new Error(`Email template not found: ${templateSlug}`)
    }

    return this.renderTemplateDocument(template, variables)
  }

  /**
   * Render a template document (for when you already have the template loaded)
   * This avoids duplicate template lookups
   * @internal
   */
  async renderTemplateDocument(template: BaseEmailTemplateDocument, variables: TemplateVariables): Promise<{ html: string; subject: string; text: string }> {
    this.ensureInitialized()

    const adapter = await this.getEngineAdapter()
    const emailContent = await this.renderEmailTemplate(template, variables)
    const subject = await adapter.render(template.subject || '', variables)

    return {
      html: emailContent.html,
      subject,
      text: emailContent.text
    }
  }

  async retryFailedEmails(): Promise<void> {
    this.ensureInitialized()
    const maxAttempts = this.config.retryAttempts || 3
    const retryDelay = this.config.retryDelay || 300000 // 5 minutes
    const retryTime = new Date(Date.now() - retryDelay).toISOString()

    const { docs: failedEmails } = await this.payload.find({
      collection: this.emailsCollection,
      limit: 20,
      where: {
        and: [
          {
            status: {
              equals: 'failed',
            },
          },
          {
            attempts: {
              less_than: maxAttempts,
            },
          },
          {
            or: [
              {
                lastAttemptAt: {
                  exists: false,
                },
              },
              {
                lastAttemptAt: {
                  less_than: retryTime,
                },
              },
            ],
          },
        ],
      },
    })

    for (const email of failedEmails) {
      await this.processEmailItem(String(email.id), 'failed')
    }
  }

}
