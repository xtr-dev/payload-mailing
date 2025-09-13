import { Payload } from 'payload'
import { getMailing, renderTemplate, parseAndValidateEmails } from './utils/helpers.js'

// Base type for email data that all emails must have
// Compatible with PayloadCMS generated types that include null
export interface BaseEmailData {
  to: string | string[]
  cc?: string | string[] | null
  bcc?: string | string[] | null
  subject?: string | null
  html?: string | null
  text?: string | null
  scheduledAt?: string | Date | null
  priority?: number | null
  [key: string]: any
}

// Options for sending emails
export interface SendEmailOptions<T extends BaseEmailData = BaseEmailData> {
  // Template-based email
  template?: {
    slug: string
    variables?: Record<string, any>
  }
  // Direct email data
  data?: Partial<T>
  // Common options
  collectionSlug?: string // defaults to 'emails'
}

/**
 * Send an email with full type safety
 *
 * @example
 * ```typescript
 * // With your generated Email type
 * import { Email } from './payload-types'
 *
 * const email = await sendEmail<Email>(payload, {
 *   template: {
 *     slug: 'welcome',
 *     variables: { name: 'John' }
 *   },
 *   data: {
 *     to: 'user@example.com',
 *     customField: 'value' // Your custom fields are type-safe!
 *   }
 * })
 * ```
 */
export const sendEmail = async <T extends BaseEmailData = BaseEmailData>(
  payload: Payload,
  options: SendEmailOptions<T>
): Promise<T> => {
  const mailing = getMailing(payload)
  const collectionSlug = options.collectionSlug || mailing.collections.emails || 'emails'

  let emailData: Partial<T> = { ...options.data } as Partial<T>

  // If using a template, render it first
  if (options.template) {
    const { html, text, subject } = await renderTemplate(
      payload,
      options.template.slug,
      options.template.variables || {}
    )

    // Template values take precedence over data values
    emailData = {
      ...emailData,
      subject,
      html,
      text,
    } as Partial<T>
  }

  // Validate required fields
  if (!emailData.to) {
    throw new Error('Field "to" is required for sending emails')
  }

  if (!emailData.subject || emailData.subject === null || !emailData.html || emailData.html === null) {
    throw new Error('Fields "subject" and "html" are required when not using a template')
  }

  // Process email addresses using shared validation (handle null values)
  if (emailData.to) {
    emailData.to = parseAndValidateEmails(emailData.to as string | string[])
  }
  if (emailData.cc && emailData.cc !== null) {
    emailData.cc = parseAndValidateEmails(emailData.cc as string | string[])
  }
  if (emailData.bcc && emailData.bcc !== null) {
    emailData.bcc = parseAndValidateEmails(emailData.bcc as string | string[])
  }

  // Convert scheduledAt to ISO string if it's a Date
  if (emailData.scheduledAt instanceof Date) {
    emailData.scheduledAt = emailData.scheduledAt.toISOString()
  }

  // Create the email in the collection
  const email = await payload.create({
    collection: collectionSlug as any,
    data: emailData as any
  })

  return email as unknown as T
}

export default sendEmail