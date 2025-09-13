import { Payload } from 'payload'
import { TemplateVariables } from '../types/index.js'

// Base type for email data that all emails must have
export interface BaseEmailData {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  html?: string
  text?: string
  scheduledAt?: string | Date
  priority?: number
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

export const getMailing = (payload: Payload) => {
  const mailing = (payload as any).mailing
  if (!mailing) {
    throw new Error('Mailing plugin not initialized. Make sure you have added the mailingPlugin to your Payload config.')
  }
  return mailing
}

export const renderTemplate = async (payload: Payload, templateSlug: string, variables: TemplateVariables): Promise<{ html: string; text: string; subject: string }> => {
  const mailing = getMailing(payload)
  return mailing.service.renderTemplate(templateSlug, variables)
}

export const processEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.processEmails()
}

export const retryFailedEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.retryFailedEmails()
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

  if (!emailData.subject || !emailData.html) {
    throw new Error('Fields "subject" and "html" are required when not using a template')
  }

  // Parse and validate email addresses
  const parseEmails = (emails: string | string[] | undefined): string[] | undefined => {
    if (!emails) return undefined

    let emailList: string[]
    if (Array.isArray(emails)) {
      emailList = emails
    } else {
      emailList = emails.split(',').map(email => email.trim()).filter(Boolean)
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = emailList.filter(email => !emailRegex.test(email))
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`)
    }

    return emailList
  }

  // Process email addresses
  if (emailData.to) {
    emailData.to = parseEmails(emailData.to as string | string[])
  }
  if (emailData.cc) {
    emailData.cc = parseEmails(emailData.cc as string | string[])
  }
  if (emailData.bcc) {
    emailData.bcc = parseEmails(emailData.bcc as string | string[])
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