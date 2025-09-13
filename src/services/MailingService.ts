import { Payload } from 'payload'
import { Liquid } from 'liquidjs'
import nodemailer, { Transporter } from 'nodemailer'
import { 
  MailingPluginConfig, 
  SendEmailOptions, 
  MailingService as IMailingService,
  EmailTemplate,
  QueuedEmail,
  MailingTransportConfig,
  EmailObject
} from '../types/index.js'
import { serializeRichTextToHTML, serializeRichTextToText } from '../utils/richTextSerializer.js'

export class MailingService implements IMailingService {
  private payload: Payload
  private config: MailingPluginConfig
  private transporter!: Transporter | any
  private templatesCollection: string
  private emailsCollection: string
  private liquid: Liquid | null = null

  constructor(payload: Payload, config: MailingPluginConfig) {
    this.payload = payload
    this.config = config
    
    const templatesConfig = config.collections?.templates
    this.templatesCollection = typeof templatesConfig === 'string' ? templatesConfig : 'email-templates'
    
    const emailsConfig = config.collections?.emails
    this.emailsCollection = typeof emailsConfig === 'string' ? emailsConfig : 'emails'
    
    this.initializeTransporter()
    this.initializeTemplateEngine()
  }

  private initializeTransporter(): void {
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
  }

  private getDefaultFrom(): string {
    const fromEmail = this.config.defaultFrom
    const fromName = this.config.defaultFromName

    // Check if fromName exists, is not empty after trimming, and fromEmail exists
    if (fromName && fromName.trim() && fromEmail) {
      // Escape quotes in the display name to prevent malformed headers
      const escapedName = fromName.replace(/"/g, '\\"')
      return `"${escapedName}" <${fromEmail}>`
    }

    return fromEmail || ''
  }

  private initializeTemplateEngine(): void {
    // Skip initialization if custom template renderer is provided
    if (this.config.templateRenderer) {
      return
    }

    // Use specified template engine or default to 'liquidjs'
    const engine = this.config.templateEngine || 'liquidjs'

    if (engine === 'liquidjs') {
      this.initializeLiquidJS()
    } else if (engine === 'mustache') {
      // Mustache doesn't need initialization, we'll use it directly in renderTemplate
      this.liquid = null
    } else if (engine === 'simple') {
      this.liquid = null
    }
  }

  private initializeLiquidJS(): void {
    try {
      const { Liquid: LiquidEngine } = require('liquidjs')
      this.liquid = new LiquidEngine()

      // Register custom filters (equivalent to Handlebars helpers)
      if (this.liquid) {
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
      this.liquid = null
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<string> {
    const emailId = await this.scheduleEmail({
      ...options,
      scheduledAt: new Date()
    })

    await this.processEmailItem(emailId)
    
    return emailId
  }

  async scheduleEmail(options: SendEmailOptions): Promise<string> {
    let html = options.html || ''
    let text = options.text || ''
    let subject = options.subject || ''
    let templateId: string | undefined = undefined

    if (options.templateSlug) {
      const template = await this.getTemplateBySlug(options.templateSlug)
      
      if (template) {
        templateId = template.id
        const variables = options.variables || {}
        const renderedContent = await this.renderEmailTemplate(template, variables)
        html = renderedContent.html
        text = renderedContent.text
        subject = await this.renderTemplate(template.subject, variables)
      } else {
        throw new Error(`Email template not found: ${options.templateSlug}`)
      }
    }

    if (!subject && !options.subject) {
      throw new Error('Email subject is required')
    }

    if (!html && !options.html) {
      throw new Error('Email HTML content is required')
    }

    const queueData = {
      template: templateId,
      to: Array.isArray(options.to) ? options.to : [options.to],
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      from: options.from || this.getDefaultFrom(),
      replyTo: options.replyTo,
      subject: subject || options.subject,
      html,
      text,
      variables: options.variables,
      scheduledAt: options.scheduledAt?.toISOString(),
      status: 'pending' as const,
      attempts: 0,
      priority: options.priority || 5,
    }

    const result = await this.payload.create({
      collection: this.emailsCollection as any,
      data: queueData,
    })

    return result.id as string
  }

  async processEmails(): Promise<void> {
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
      }) as QueuedEmail

      let emailObject: EmailObject = {
        from: email.from || this.getDefaultFrom(),
        to: email.to,
        cc: email.cc || undefined,
        bcc: email.bcc || undefined,
        replyTo: email.replyTo || undefined,
        subject: email.subject,
        html: email.html,
        text: email.text || undefined,
        variables: email.variables,
      }

      // Apply emailWrapper hook if configured
      if (this.config.emailWrapper) {
        emailObject = await this.config.emailWrapper(emailObject)
      }

      const mailOptions = {
        from: emailObject.from,
        to: emailObject.to,
        cc: emailObject.cc || undefined,
        bcc: emailObject.bcc || undefined,
        replyTo: emailObject.replyTo || undefined,
        subject: emailObject.subject,
        html: emailObject.html,
        text: emailObject.text || undefined,
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
    }) as QueuedEmail

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

  private async getTemplateBySlug(templateSlug: string): Promise<EmailTemplate | null> {
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
      
      return docs.length > 0 ? docs[0] as EmailTemplate : null
    } catch (error) {
      console.error(`Template with slug '${templateSlug}' not found:`, error)
      return null
    }
  }

  private async renderTemplate(template: string, variables: Record<string, any>): Promise<string> {
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

    // Use LiquidJS if available and configured
    if (engine === 'liquidjs' && this.liquid) {
      try {
        return await this.liquid.parseAndRender(template, variables)
      } catch (error) {
        console.error('LiquidJS template rendering error:', error)
        return template
      }
    }

    // Use Mustache if configured
    if (engine === 'mustache') {
      try {
        const Mustache = require('mustache')
        return Mustache.render(template, variables)
      } catch (error) {
        console.warn('Mustache not available. Falling back to simple variable replacement. Install mustache package.')
        return this.simpleVariableReplacement(template, variables)
      }
    }

    // Fallback to simple variable replacement
    return this.simpleVariableReplacement(template, variables)
  }

  private simpleVariableReplacement(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key]
      return value !== undefined ? String(value) : match
    })
  }

  private async renderEmailTemplate(template: EmailTemplate, variables: Record<string, any> = {}): Promise<{ html: string; text: string }> {
    if (!template.content) {
      return { html: '', text: '' }
    }

    // Serialize richtext to HTML and text
    let html = serializeRichTextToHTML(template.content)
    let text = serializeRichTextToText(template.content)

    // Apply template variables to the rendered content
    html = await this.renderTemplate(html, variables)
    text = await this.renderTemplate(text, variables)

    return { html, text }
  }

}