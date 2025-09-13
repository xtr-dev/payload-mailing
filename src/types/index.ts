import { Payload } from 'payload'
import type { CollectionConfig, RichTextField } from 'payload'
import { Transporter } from 'nodemailer'

// Generic base interfaces that work with any ID type and null values
export interface BaseEmailDocument {
  id: string | number
  template?: any
  to: string[]
  cc?: string[] | null
  bcc?: string[] | null
  from?: string | null
  replyTo?: string | null
  subject: string
  html: string
  text?: string | null
  variables?: Record<string, any> | null
  scheduledAt?: string | null
  sentAt?: string | null
  status?: 'pending' | 'processing' | 'sent' | 'failed' | null
  attempts?: number | null
  lastAttemptAt?: string | null
  error?: string | null
  priority?: number | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface BaseEmailTemplateDocument {
  id: string | number
  name: string
  slug: string
  subject?: string | null
  content?: any
  createdAt?: string | null
  updatedAt?: string | null
}

export type BaseEmail<TEmail extends BaseEmailDocument = BaseEmailDocument, TEmailTemplate extends BaseEmailTemplateDocument = BaseEmailTemplateDocument> = Omit<TEmail, 'id' | 'template'> & {template: Omit<TEmailTemplate, 'id'> | TEmailTemplate['id'] | undefined | null}

export type BaseEmailTemplate<TEmailTemplate extends BaseEmailTemplateDocument = BaseEmailTemplateDocument> = Omit<TEmailTemplate, 'id'>

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


export interface QueuedEmail {
  id: string
  template?: string | null
  to: string[]
  cc?: string[] | null
  bcc?: string[] | null
  from?: string | null
  replyTo?: string | null
  subject: string
  html: string
  text?: string | null
  variables?: Record<string, any> | null
  scheduledAt?: string | null
  sentAt?: string | null
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  lastAttemptAt?: string | null
  error?: string | null
  priority?: number | null
  createdAt: string
  updatedAt: string
}

// Simple helper type for template variables
export interface TemplateVariables {
  [key: string]: any
}

export interface MailingService {
  processEmails(): Promise<void>
  retryFailedEmails(): Promise<void>
  renderTemplate(templateSlug: string, variables: TemplateVariables): Promise<{ html: string; text: string; subject: string }>
}

export interface MailingContext {
  payload: Payload
  config: MailingPluginConfig
  service: MailingService
}
