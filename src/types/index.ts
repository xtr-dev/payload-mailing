import type { CollectionConfig, Payload,RichTextField, SendEmailOptions } from 'payload'

// Payload ID type (string or number)
export type PayloadID = number | string

// Payload relation type - can be populated (object with id) or unpopulated (just the ID)
export type PayloadRelation<T extends { id: PayloadID }> = PayloadID | T

// JSON value type that matches Payload's JSON field type
export type JSONValue = { [k: string]: unknown } | boolean | null | number | string | undefined | unknown[]

// Generic base interfaces that work with any ID type and null values
export interface BaseEmailDocument {
  attempts?: null | number
  bcc?: null | string[]
  cc?: null | string[]
  createdAt?: Date | null | string
  error?: null | string
  from?: null | string
  fromName?: null | string
  html: string
  id: number | string
  lastAttemptAt?: Date | null | string
  priority?: null | number
  replyTo?: null | string
  scheduledAt?: Date | null | string
  sentAt?: Date | null | string
  status?: 'failed' | 'pending' | 'processing' | 'sent' | null
  subject: string
  template?: any
  templateSlug?: null | string
  text?: null | string
  to: string[]
  updatedAt?: Date | null | string
  variables?: JSONValue
}

export interface BaseEmailTemplateDocument {
  content?: any
  createdAt?: Date | null | string
  id: number | string
  name: string
  slug: string
  subject?: null | string
  updatedAt?: Date | null | string
}

export type TemplateRendererHook = (template: string, variables: Record<string, any>) => Promise<string> | string

export type TemplateEngine = 'liquidjs' | 'mustache' | 'simple'

export type BeforeSendHook = (options: SendEmailOptions, email: BaseEmailDocument) => Promise<SendEmailOptions> | SendEmailOptions

/**
 * @deprecated No longer used. `sendEmail({ processImmediately: true })` no longer
 * polls for the auto-scheduled job — the job ID is handed back synchronously via
 * the request context when the email is created — so these tuning options have no
 * effect and will be removed in a future release.
 */
export interface JobPollingConfig {
  initialDelay?: number       // Initial delay in milliseconds (default: 25)
  maxAttempts?: number        // Maximum number of polling attempts (default: 5)
  maxBackoffDelay?: number    // Maximum delay between attempts in milliseconds (default: 400)
  maxTotalTime?: number       // Maximum total polling time in milliseconds (default: 3000)
}

export interface MailingPluginConfig {
  beforeSend?: BeforeSendHook
  collections?: {
    emails?: Partial<CollectionConfig> | string
    templates?: Partial<CollectionConfig> | string
  }
  defaultFrom?: string
  defaultFromName?: string
  initOrder?: 'after' | 'before'
  /** @deprecated No longer used — immediate sends no longer poll. See {@link JobPollingConfig}. */
  jobPolling?: JobPollingConfig
  queue?: string
  retryAttempts?: number
  retryDelay?: number
  richTextEditor?: RichTextField['editor']
  templateEngine?: TemplateEngine
  templateRenderer?: TemplateRendererHook
}

export interface QueuedEmail {
  attempts: number
  bcc?: null | string[]
  cc?: null | string[]
  createdAt: string
  error?: null | string
  from?: null | string
  fromName?: null | string
  html: string
  id: string
  lastAttemptAt?: Date | null | string
  priority?: null | number
  replyTo?: null | string
  scheduledAt?: Date | null | string
  sentAt?: Date | null | string
  status: 'failed' | 'pending' | 'processing' | 'sent'
  subject: string
  template?: null | string
  text?: null | string
  to: string[]
  updatedAt: string
  variables?: JSONValue
}

// Simple helper type for template variables
export interface TemplateVariables {
  [key: string]: any
}

export interface MailingService {
  processEmailItem(emailId: string, expectedStatus?: 'failed' | 'pending'): Promise<void>
  processEmails(): Promise<void>
  renderTemplate(templateSlug: string, variables: TemplateVariables): Promise<{ html: string; subject: string; text: string }>
  renderTemplateDocument(template: BaseEmailTemplateDocument, variables: TemplateVariables): Promise<{ html: string; subject: string; text: string }>
  retryFailedEmails(): Promise<void>
}

export interface MailingContext {
  collections: {
    emails: string
    templates: string
  }
  config: MailingPluginConfig
  payload: Payload
  service: MailingService
}
