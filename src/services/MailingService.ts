import { Payload } from 'payload'
import Handlebars from 'handlebars'
import nodemailer, { Transporter } from 'nodemailer'
import { 
  MailingPluginConfig, 
  SendEmailOptions, 
  MailingService as IMailingService,
  EmailTemplate,
  OutboxEmail,
  MailingTransportConfig
} from '../types'

export class MailingService implements IMailingService {
  private payload: Payload
  private config: MailingPluginConfig
  private transporter: Transporter
  private templatesCollection: string
  private outboxCollection: string

  constructor(payload: Payload, config: MailingPluginConfig) {
    this.payload = payload
    this.config = config
    this.templatesCollection = config.collections?.templates || 'email-templates'
    this.outboxCollection = config.collections?.outbox || 'email-outbox'
    
    this.initializeTransporter()
    this.registerHandlebarsHelpers()
  }

  private initializeTransporter(): void {
    if (this.config.transport) {
      if ('sendMail' in this.config.transport) {
        this.transporter = this.config.transport
      } else {
        this.transporter = nodemailer.createTransporter(this.config.transport as MailingTransportConfig)
      }
    } else {
      throw new Error('Email transport configuration is required')
    }
  }

  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date, format?: string) => {
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

    Handlebars.registerHelper('formatCurrency', (amount: number, currency = 'USD') => {
      if (typeof amount !== 'number') return amount
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount)
    })

    Handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this)
    })

    Handlebars.registerHelper('capitalize', (str: string) => {
      if (typeof str !== 'string') return str
      return str.charAt(0).toUpperCase() + str.slice(1)
    })
  }

  async sendEmail(options: SendEmailOptions): Promise<string> {
    const outboxId = await this.scheduleEmail({
      ...options,
      scheduledAt: new Date()
    })

    await this.processOutboxItem(outboxId)
    
    return outboxId
  }

  async scheduleEmail(options: SendEmailOptions): Promise<string> {
    let html = options.html || ''
    let text = options.text || ''
    let subject = options.subject || ''

    if (options.templateId) {
      const template = await this.getTemplate(options.templateId)
      if (template) {
        const variables = options.variables || {}
        
        html = this.renderTemplate(template.htmlTemplate, variables)
        text = template.textTemplate ? this.renderTemplate(template.textTemplate, variables) : ''
        subject = this.renderTemplate(template.subject, variables)
      }
    }

    if (!subject && !options.subject) {
      throw new Error('Email subject is required')
    }

    if (!html && !options.html) {
      throw new Error('Email HTML content is required')
    }

    const outboxData = {
      template: options.templateId || undefined,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      from: options.from || this.config.defaultFrom,
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
      collection: this.outboxCollection,
      data: outboxData,
    })

    return result.id as string
  }

  async processOutbox(): Promise<void> {
    const currentTime = new Date().toISOString()
    
    const { docs: pendingEmails } = await this.payload.find({
      collection: this.outboxCollection,
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
      await this.processOutboxItem(email.id)
    }
  }

  async retryFailedEmails(): Promise<void> {
    const maxAttempts = this.config.retryAttempts || 3
    const retryDelay = this.config.retryDelay || 300000 // 5 minutes
    const retryTime = new Date(Date.now() - retryDelay).toISOString()

    const { docs: failedEmails } = await this.payload.find({
      collection: this.outboxCollection,
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
      await this.processOutboxItem(email.id)
    }
  }

  private async processOutboxItem(outboxId: string): Promise<void> {
    try {
      await this.payload.update({
        collection: this.outboxCollection,
        id: outboxId,
        data: {
          status: 'processing',
          lastAttemptAt: new Date().toISOString(),
        },
      })

      const email = await this.payload.findByID({
        collection: this.outboxCollection,
        id: outboxId,
      }) as OutboxEmail

      const mailOptions = {
        from: email.from || this.config.defaultFrom,
        to: email.to,
        cc: email.cc || undefined,
        bcc: email.bcc || undefined,
        replyTo: email.replyTo || undefined,
        subject: email.subject,
        html: email.html,
        text: email.text || undefined,
      }

      await this.transporter.sendMail(mailOptions)

      await this.payload.update({
        collection: this.outboxCollection,
        id: outboxId,
        data: {
          status: 'sent',
          sentAt: new Date().toISOString(),
          error: null,
        },
      })

    } catch (error) {
      const attempts = await this.incrementAttempts(outboxId)
      const maxAttempts = this.config.retryAttempts || 3

      await this.payload.update({
        collection: this.outboxCollection,
        id: outboxId,
        data: {
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastAttemptAt: new Date().toISOString(),
        },
      })

      if (attempts >= maxAttempts) {
        console.error(`Email ${outboxId} failed permanently after ${attempts} attempts:`, error)
      }
    }
  }

  private async incrementAttempts(outboxId: string): Promise<number> {
    const email = await this.payload.findByID({
      collection: this.outboxCollection,
      id: outboxId,
    }) as OutboxEmail

    const newAttempts = (email.attempts || 0) + 1

    await this.payload.update({
      collection: this.outboxCollection,
      id: outboxId,
      data: {
        attempts: newAttempts,
      },
    })

    return newAttempts
  }

  private async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    try {
      const template = await this.payload.findByID({
        collection: this.templatesCollection,
        id: templateId,
      })
      return template as EmailTemplate
    } catch (error) {
      console.error(`Template ${templateId} not found:`, error)
      return null
    }
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    try {
      const compiled = Handlebars.compile(template)
      return compiled(variables)
    } catch (error) {
      console.error('Template rendering error:', error)
      return template
    }
  }
}