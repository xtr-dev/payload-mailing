import type { Liquid } from 'liquidjs'
import type {CollectionSlug, Payload, SendEmailOptions} from 'payload';

import { EmailAdapter} from 'payload'

import type {
  BaseEmailDocument,
  BaseEmailTemplateDocument,
  MailingService as IMailingService,
  MailingPluginConfig, TemplateVariables
} from '../types/index.js'

import { sanitizeDisplayName } from '../utils/helpers.js'
import { serializeRichTextToHTML, serializeRichTextToText } from '../utils/richTextSerializer.js'

export class MailingService implements IMailingService {
  private config: MailingPluginConfig
  private emailsCollection: string
  private liquid: false | Liquid | null = null
  private templatesCollection: string
  public payload: Payload

  constructor(payload: Payload, config: MailingPluginConfig) {
    this.payload = payload
    this.config = config

    const templatesConfig = config.collections?.templates
    this.templatesCollection = typeof templatesConfig === 'string' ? templatesConfig : 'email-templates'

    const emailsConfig = config.collections?.emails
    this.emailsCollection = typeof emailsConfig === 'string' ? emailsConfig : 'emails'

    // Use Payload's configured email adapter
    if (!this.payload.email) {
      throw new Error('Payload email configuration is required. Please configure email in your Payload config.')
    }
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

    try {
      const liquidModule = await import('liquidjs')
      const { Liquid: LiquidEngine } = liquidModule
      this.liquid = new LiquidEngine()

      // Register custom filters (equivalent to Handlebars helpers)
      if (this.liquid && typeof this.liquid !== 'boolean') {
        this.liquid.registerFilter('formatDate', (date: any, format?: string) => {
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

        this.liquid.registerFilter('formatCurrency', (amount: any, currency = 'USD') => {
          if (typeof amount !== 'number') {return amount}
          return new Intl.NumberFormat('en-US', {
            currency,
            style: 'currency'
          }).format(amount)
        })

        this.liquid.registerFilter('capitalize', (str: any) => {
          if (typeof str !== 'string') {return str}
          return str.charAt(0).toUpperCase() + str.slice(1)
        })
      }
    } catch (error) {
      console.warn('LiquidJS not available. Falling back to simple variable replacement. Install liquidjs or use a different templateEngine.')
      this.liquid = false // Mark as failed to avoid retries
    }
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

  private async getTemplateBySlug(templateSlug: string): Promise<BaseEmailTemplateDocument | null> {
    try {
      const { docs } = await this.payload.find({
        collection: this.templatesCollection as any,
        limit: 1,
        where: {
          slug: {
            equals: templateSlug,
          },
        },
      })

      return docs.length > 0 ? docs[0] as BaseEmailTemplateDocument : null
    } catch (error) {
      console.error(`Template with slug '${templateSlug}' not found:`, error)
      return null
    }
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

  private async renderEmailTemplate(template: BaseEmailTemplateDocument, variables: Record<string, any> = {}): Promise<{ html: string; text: string }> {
    if (!template.content) {
      return { html: '', text: '' }
    }

    // Serialize richtext to HTML and text
    let html = serializeRichTextToHTML(template.content)
    let text = serializeRichTextToText(template.content)

    // Apply template variables to the rendered content
    html = await this.renderTemplateString(html, variables)
    text = await this.renderTemplateString(text, variables)

    return { html, text }
  }

  private async renderTemplateString(template: string, variables: Record<string, any>): Promise<string> {
    // Use custom template renderer if provided
    if (this.config.templateRenderer) {
      try {
        return await this.config.templateRenderer(template, variables)
      } catch (error) {
        console.error('Custom template renderer error:', error)
        return template
      }
    }

    const engine = this.config.templateEngine || 'liquidjs'

    // Use LiquidJS if configured
    if (engine === 'liquidjs') {
      try {
        await this.ensureLiquidJSInitialized()
        if (this.liquid) {
          return await this.liquid.parseAndRender(template, variables)
        }
      } catch (error) {
        console.error('LiquidJS template rendering error:', error)
      }
    }

    // Use Mustache if configured
    if (engine === 'mustache') {
      try {
        const mustacheResult = await this.renderWithMustache(template, variables)
        if (mustacheResult !== null) {
          return mustacheResult
        }
      } catch (error) {
        console.warn('Mustache not available. Falling back to simple variable replacement. Install mustache package.')
      }
    }

    // Fallback to simple variable replacement
    return this.simpleVariableReplacement(template, variables)
  }

  private async renderWithMustache(template: string, variables: Record<string, any>): Promise<null | string> {
    try {
      const mustacheModule = await import('mustache')
      const Mustache = mustacheModule.default || mustacheModule
      return Mustache.render(template, variables)
    } catch (error) {
      return null
    }
  }

  /**
   * Sanitizes a display name for use in email headers to prevent header injection
   * Uses the centralized sanitization utility with quote escaping for headers
   */
  private sanitizeDisplayName(name: string): string {
    return sanitizeDisplayName(name, true) // escapeQuotes = true for email headers
  }

  private simpleVariableReplacement(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key]
      return value !== undefined ? String(value) : match
    })
  }

  async processEmailItem(emailId: string): Promise<void> {
    try {
      await this.payload.update({
        id: emailId,
        collection: this.emailsCollection,
        data: {
          lastAttemptAt: new Date().toISOString(),
          status: 'processing',
        },
      })

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
          console.error('Error in beforeSend hook:', error)
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
        console.error(`Email ${emailId} failed permanently after ${attempts} attempts:`, error)
      }
    }
  }

  async processEmails(): Promise<void> {
    this.ensureInitialized()
    const currentTime = new Date().toISOString()

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
      await this.processEmailItem(String(email.id))
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

    const emailContent = await this.renderEmailTemplate(template, variables)
    const subject = await this.renderTemplateString(template.subject || '', variables)

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
      await this.processEmailItem(String(email.id))
    }
  }

}
