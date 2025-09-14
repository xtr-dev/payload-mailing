import { Payload } from 'payload'
import { Liquid } from 'liquidjs'
import nodemailer, { Transporter } from 'nodemailer'
import {
  MailingPluginConfig,
  TemplateVariables,
  MailingService as IMailingService,
  MailingTransportConfig,
  BaseEmail, BaseEmailTemplate, BaseEmailDocument, BaseEmailTemplateDocument
} from '../types/index.js'
import { serializeRichTextToHTML, serializeRichTextToText } from '../utils/richTextSerializer.js'

export class MailingService implements IMailingService {
  public payload: Payload
  private config: MailingPluginConfig
  private transporter!: Transporter | any
  private templatesCollection: string
  private emailsCollection: string
  private liquid: Liquid | null | false = null
  private transporterInitialized = false

  constructor(payload: Payload, config: MailingPluginConfig) {
    this.payload = payload
    this.config = config

    const templatesConfig = config.collections?.templates
    this.templatesCollection = typeof templatesConfig === 'string' ? templatesConfig : 'email-templates'

    const emailsConfig = config.collections?.emails
    this.emailsCollection = typeof emailsConfig === 'string' ? emailsConfig : 'emails'

    // Only initialize transporter if payload is properly set
    if (payload && payload.db) {
      this.initializeTransporter()
    }
  }

  private initializeTransporter(): void {
    if (this.transporterInitialized) return

    if (this.config.transport) {
      if ('sendMail' in this.config.transport) {
        this.transporter = this.config.transport
      } else {
        this.transporter = nodemailer.createTransport(this.config.transport as MailingTransportConfig)
      }
    } else if (this.payload.email && 'sendMail' in this.payload.email) {
      // Use Payload's configured mailer (cast to any to handle different adapter types)
      this.transporter = this.payload.email as any
    } else {
      throw new Error('Email transport configuration is required either in plugin config or Payload config')
    }

    this.transporterInitialized = true
  }

  private ensureInitialized(): void {
    if (!this.payload || !this.payload.db) {
      throw new Error('MailingService payload not properly initialized')
    }
    if (!this.transporterInitialized) {
      this.initializeTransporter()
    }
  }

  /**
   * Sanitizes a display name for use in email headers to prevent header injection
   * and ensure proper formatting
   */
  private sanitizeDisplayName(name: string): string {
    return name
      .trim()
      // Remove/replace newlines and carriage returns to prevent header injection
      .replace(/[\r\n]/g, ' ')
      // Remove control characters (except space and printable characters)
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Escape quotes to prevent malformed headers
      .replace(/"/g, '\\"')
  }

  /**
   * Formats an email address with optional display name
   */
  private formatEmailAddress(email: string, displayName?: string | null): string {
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

  private async ensureLiquidJSInitialized(): Promise<void> {
    if (this.liquid !== null) return // Already initialized or failed

    try {
      const liquidModule = await import('liquidjs')
      const { Liquid: LiquidEngine } = liquidModule
      this.liquid = new LiquidEngine()

      // Register custom filters (equivalent to Handlebars helpers)
      if (this.liquid && typeof this.liquid !== 'boolean') {
        this.liquid.registerFilter('formatDate', (date: any, format?: string) => {
          if (!date) return ''
          const d = new Date(date)
          if (format === 'short') {
            return d.toLocaleDateString()
          }
          if (format === 'long') {
            return d.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          }
          return d.toLocaleString()
        })

        this.liquid.registerFilter('formatCurrency', (amount: any, currency = 'USD') => {
          if (typeof amount !== 'number') return amount
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          }).format(amount)
        })

        this.liquid.registerFilter('capitalize', (str: any) => {
          if (typeof str !== 'string') return str
          return str.charAt(0).toUpperCase() + str.slice(1)
        })
      }
    } catch (error) {
      console.warn('LiquidJS not available. Falling back to simple variable replacement. Install liquidjs or use a different templateEngine.')
      this.liquid = false // Mark as failed to avoid retries
    }
  }

  async renderTemplate(templateSlug: string, variables: TemplateVariables): Promise<{ html: string; text: string; subject: string }> {
    this.ensureInitialized()
    const template = await this.getTemplateBySlug(templateSlug)

    if (!template) {
      throw new Error(`Email template not found: ${templateSlug}`)
    }

    const emailContent = await this.renderEmailTemplate(template, variables)
    const subject = await this.renderTemplateString(template.subject || '', variables)

    return {
      html: emailContent.html,
      text: emailContent.text,
      subject
    }
  }

  async processEmails(): Promise<void> {
    this.ensureInitialized()
    const currentTime = new Date().toISOString()

    const { docs: pendingEmails } = await this.payload.find({
      collection: this.emailsCollection as any,
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
      sort: 'priority,-createdAt',
      limit: 50,
    })

    for (const email of pendingEmails) {
      await this.processEmailItem(String(email.id))
    }
  }

  async retryFailedEmails(): Promise<void> {
    this.ensureInitialized()
    const maxAttempts = this.config.retryAttempts || 3
    const retryDelay = this.config.retryDelay || 300000 // 5 minutes
    const retryTime = new Date(Date.now() - retryDelay).toISOString()

    const { docs: failedEmails } = await this.payload.find({
      collection: this.emailsCollection as any,
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
      limit: 20,
    })

    for (const email of failedEmails) {
      await this.processEmailItem(String(email.id))
    }
  }

  private async processEmailItem(emailId: string): Promise<void> {
    try {
      await this.payload.update({
        collection: this.emailsCollection as any,
        id: emailId,
        data: {
          status: 'processing',
          lastAttemptAt: new Date().toISOString(),
        },
      })

      const email = await this.payload.findByID({
        collection: this.emailsCollection as any,
        id: emailId,
      }) as BaseEmailDocument

      // Combine from and fromName for nodemailer using proper sanitization
      let fromField: string
      if (email.from) {
        fromField = this.formatEmailAddress(email.from, email.fromName)
      } else {
        fromField = this.getDefaultFrom()
      }

      let mailOptions: any = {
        from: fromField,
        to: email.to,
        cc: email.cc || undefined,
        bcc: email.bcc || undefined,
        replyTo: email.replyTo || undefined,
        subject: email.subject,
        html: email.html,
        text: email.text || undefined,
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

      await this.transporter.sendMail(mailOptions)

      await this.payload.update({
        collection: this.emailsCollection as any,
        id: emailId,
        data: {
          status: 'sent',
          sentAt: new Date().toISOString(),
          error: null,
        },
      })

    } catch (error) {
      const attempts = await this.incrementAttempts(emailId)
      const maxAttempts = this.config.retryAttempts || 3

      await this.payload.update({
        collection: this.emailsCollection as any,
        id: emailId,
        data: {
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastAttemptAt: new Date().toISOString(),
        },
      })

      if (attempts >= maxAttempts) {
        console.error(`Email ${emailId} failed permanently after ${attempts} attempts:`, error)
      }
    }
  }

  private async incrementAttempts(emailId: string): Promise<number> {
    const email = await this.payload.findByID({
      collection: this.emailsCollection as any,
      id: emailId,
    }) as BaseEmail

    const newAttempts = (email.attempts || 0) + 1

    await this.payload.update({
      collection: this.emailsCollection as any,
      id: emailId,
      data: {
        attempts: newAttempts,
      },
    })

    return newAttempts
  }

  private async getTemplateBySlug(templateSlug: string): Promise<BaseEmailTemplateDocument | null> {
    try {
      const { docs } = await this.payload.find({
        collection: this.templatesCollection as any,
        where: {
          slug: {
            equals: templateSlug,
          },
        },
        limit: 1,
      })

      return docs.length > 0 ? docs[0] as BaseEmailTemplateDocument : null
    } catch (error) {
      console.error(`Template with slug '${templateSlug}' not found:`, error)
      return null
    }
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
        if (this.liquid && typeof this.liquid !== 'boolean') {
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

  private async renderWithMustache(template: string, variables: Record<string, any>): Promise<string | null> {
    try {
      const mustacheModule = await import('mustache')
      const Mustache = mustacheModule.default || mustacheModule
      return Mustache.render(template, variables)
    } catch (error) {
      return null
    }
  }

  private simpleVariableReplacement(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key]
      return value !== undefined ? String(value) : match
    })
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

}
