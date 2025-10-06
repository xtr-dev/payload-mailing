import { Payload } from 'payload'
import type { CollectionConfig, RichTextField } from 'payload'

// Payload ID type (string or number)
export type PayloadID = string | number

// Payload relation type - can be populated (object with id) or unpopulated (just the ID)
export type PayloadRelation<T extends { id: PayloadID }> = T | PayloadID

// JSON value type that matches Payload's JSON field type
export type JSONValue = string | number | boolean | { [k: string]: unknown } | unknown[] | null | undefined

// Generic base interfaces that work with any ID type and null values
export interface BaseEmailDocument {
  id: string | number
  template?: any
  to: string[]
  cc?: string[] | null
  bcc?: string[] | null
  from?: string | null
  fromName?: string | null
  replyTo?: string | null
  subject: string
  html: string
  text?: string | null
  variables?: JSONValue
  scheduledAt?: string | Date | null
  sentAt?: string | Date | null
  status?: 'pending' | 'processing' | 'sent' | 'failed' | null
  attempts?: number | null
  lastAttemptAt?: string | Date | null
  error?: string | null
  priority?: number | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

export interface BaseEmailTemplateDocument {
  id: string | number
  name: string
  slug: string
  subject?: string | null
  content?: any
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

export type BaseEmail<TEmail extends BaseEmailDocument = BaseEmailDocument, TEmailTemplate extends BaseEmailTemplateDocument = BaseEmailTemplateDocument> = Omit<TEmail, 'id' | 'template'> & {template: Omit<TEmailTemplate, 'id'> | TEmailTemplate['id'] | undefined | null}

export type BaseEmailTemplate<TEmailTemplate extends BaseEmailTemplateDocument = BaseEmailTemplateDocument> = Omit<TEmailTemplate, 'id'>

export type TemplateRendererHook = (template: string, variables: Record<string, any>) => string | Promise<string>

export type TemplateEngine = 'liquidjs' | 'mustache' | 'simple'

export interface BeforeSendMailOptions {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  html: string
  text?: string
  attachments?: any[]
  [key: string]: any
}

export type BeforeSendHook = (options: BeforeSendMailOptions, email: BaseEmailDocument) => BeforeSendMailOptions | Promise<BeforeSendMailOptions>

export interface JobPollingConfig {
  maxAttempts?: number        // Maximum number of polling attempts (default: 5)
  initialDelay?: number       // Initial delay in milliseconds (default: 25)
  maxTotalTime?: number       // Maximum total polling time in milliseconds (default: 3000)
  maxBackoffDelay?: number    // Maximum delay between attempts in milliseconds (default: 400)
}

export interface MailingPluginConfig {
  collections?: {
    templates?: string | Partial<CollectionConfig>
    emails?: string | Partial<CollectionConfig>
  }
  defaultFrom?: string
  defaultFromName?: string
  queue?: string
  retryAttempts?: number
  retryDelay?: number
  templateRenderer?: TemplateRendererHook
  templateEngine?: TemplateEngine
  richTextEditor?: RichTextField['editor']
  beforeSend?: BeforeSendHook
  initOrder?: 'before' | 'after'
  jobPolling?: JobPollingConfig
}

export interface QueuedEmail {
  id: string
  template?: string | null
  to: string[]
  cc?: string[] | null
  bcc?: string[] | null
  from?: string | null
  fromName?: string | null
  replyTo?: string | null
  subject: string
  html: string
  text?: string | null
  variables?: JSONValue
  scheduledAt?: string | Date | null
  sentAt?: string | Date | null
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  lastAttemptAt?: string | Date | null
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
  processEmailItem(emailId: string): Promise<void>
  retryFailedEmails(): Promise<void>
  renderTemplate(templateSlug: string, variables: TemplateVariables): Promise<{ html: string; text: string; subject: string }>
}

export interface MailingContext {
  payload: Payload
  config: MailingPluginConfig
  service: MailingService
}
