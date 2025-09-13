import { Payload } from 'payload'
import type { CollectionConfig, RichTextField } from 'payload'
import { Transporter } from 'nodemailer'

export interface EmailObject {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, any>
}

export type EmailWrapperHook = (email: EmailObject) => EmailObject | Promise<EmailObject>

export type TemplateRendererHook = (template: string, variables: Record<string, any>) => string | Promise<string>

export type TemplateEngine = 'liquidjs' | 'mustache' | 'simple'

export interface MailingPluginConfig {
  collections?: {
    templates?: string | Partial<CollectionConfig>
    emails?: string | Partial<CollectionConfig>
  }
  defaultFrom?: string
  defaultFromName?: string
  transport?: Transporter | MailingTransportConfig
  queue?: string
  retryAttempts?: number
  retryDelay?: number
  emailWrapper?: EmailWrapperHook
  templateRenderer?: TemplateRendererHook
  templateEngine?: TemplateEngine
  richTextEditor?: RichTextField['editor']
  onReady?: (payload: any) => Promise<void>
  initOrder?: 'before' | 'after'
}

export interface MailingTransportConfig {
  host: string
  port: number
  secure?: boolean
  auth?: {
    user: string
    pass: string
  }
}

export interface EmailTemplate {
  id: string
  name: string
  slug: string
  subject: string
  content: any // Lexical editor state
  createdAt: string
  updatedAt: string
}


export interface QueuedEmail {
  id: string
  template?: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, any>
  scheduledAt?: string
  sentAt?: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  lastAttemptAt?: string
  error?: string
  priority?: number
  createdAt: string
  updatedAt: string
}

export interface SendEmailOptions {
  templateSlug?: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  replyTo?: string
  subject?: string
  html?: string
  text?: string
  variables?: Record<string, any>
  scheduledAt?: Date
  priority?: number
}

export interface MailingService {
  sendEmail(options: SendEmailOptions): Promise<string>
  scheduleEmail(options: SendEmailOptions): Promise<string>
  processEmails(): Promise<void>
  retryFailedEmails(): Promise<void>
}

export interface MailingContext {
  payload: Payload
  config: MailingPluginConfig
  service: MailingService
}
