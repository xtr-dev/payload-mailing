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
  // Name of the configured layout to wrap this template's body in, or 'none'
  // / null to opt out. When unset, the plugin's defaultLayout (if any) applies.
  layout?: null | string
  name: string
  slug: string
  subject?: null | string
  updatedAt?: Date | null | string
}

export type TemplateRendererHook = (template: string, variables: Record<string, any>) => Promise<string> | string

export type TemplateEngine = 'liquidjs' | 'mustache' | 'simple'

export type BeforeSendHook = (options: SendEmailOptions, email: BaseEmailDocument) => Promise<SendEmailOptions> | SendEmailOptions

/**
 * A reusable email layout. The rendered template body is injected into the
 * layout at the `{{ content }}` slot, producing the final HTML (and, when a
 * `text` layout is provided, the final plain-text body). Layout strings are
 * rendered through the same template engine as templates themselves, so they
 * can use the same variables, filters, and `{{ content }}` slot syntax.
 */
export interface EmailLayout {
  /**
   * HTML layout wrapper. Must contain a `{{ content }}` slot where the rendered
   * template HTML body is injected (e.g. `<html><body>{{ content }}</body></html>`).
   */
  html: string
  /**
   * Optional plain-text layout wrapper. Must contain a `{{ content }}` slot
   * where the rendered plain-text body is injected so the text/MIME alternative
   * stays correct. When omitted, the plain-text body is left unwrapped,
   * preserving the current (pre-layout) plain-text behavior.
   */
  text?: string
}

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
  /**
   * Enables the in-admin template render preview (live HTML + plain-text) on the
   * templates collection. Enabled by default. Set to `false` to omit the preview
   * UI field and its client component — useful for apps that prefer not to
   * regenerate their importMap. The preview render endpoint is registered
   * regardless of this flag.
   */
  adminPreview?: boolean
  beforeSend?: BeforeSendHook
  collections?: {
    emails?: Partial<CollectionConfig> | string
    templates?: Partial<CollectionConfig> | string
  }
  defaultFrom?: string
  defaultFromName?: string
  /**
   * Name of the layout (a key of `layouts`) applied to templates that do not
   * select their own layout. When omitted, templates with no explicit layout
   * render exactly as they did before layouts existed (no wrapping).
   */
  defaultLayout?: string
  initOrder?: 'after' | 'before'
  /** @deprecated No longer used — immediate sends no longer poll. See {@link JobPollingConfig}. */
  jobPolling?: JobPollingConfig
  /**
   * Named, reusable email layouts. Each key is a layout name selectable per
   * template (via the template's `layout` field) and usable as `defaultLayout`.
   * The rendered template body is injected into the layout's `{{ content }}`
   * slot. Defining layouts in config keeps them versioned in code with no new
   * collection or migration; a collection-based alternative may be offered in a
   * future release for editor-managed layouts.
   */
  layouts?: { [name: string]: EmailLayout }
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
