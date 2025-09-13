import { Payload } from 'payload'
import { getMailing, renderTemplate, parseAndValidateEmails } from './utils/helpers.js'
import {Email, EmailTemplate} from "./payload-types.js"
import {BaseEmail} from "./types/index.js"

// Options for sending emails
export interface SendEmailOptions<T extends BaseEmail = BaseEmail> {
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
export const sendEmail = async <TEmail extends Email = Email, TEmailTemplate extends EmailTemplate = EmailTemplate>(
  payload: Payload,
  options: SendEmailOptions<BaseEmail<TEmail, TEmailTemplate>>
): Promise<TEmail> => {
  const mailing = getMailing(payload)
  const collectionSlug = options.collectionSlug || mailing.collections.emails || 'emails'

  let emailData: Partial<TEmail> = { ...options.data } as Partial<TEmail>

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
    } as Partial<TEmail>
  }

  // Validate required fields
  if (!emailData.to) {
    throw new Error('Field "to" is required for sending emails')
  }

  // Validate required fields based on whether template was used
  if (options.template) {
    // When using template, subject and html should have been set by renderTemplate
    if (!emailData.subject || !emailData.html) {
      throw new Error(`Template rendering failed: template "${options.template.slug}" did not provide required subject and html content`)
    }
  } else {
    // When not using template, user must provide subject and html directly
    if (!emailData.subject || !emailData.html) {
      throw new Error('Fields "subject" and "html" are required when sending direct emails without a template')
    }
  }

  // Process email addresses using shared validation (handle null values)
  if (emailData.to) {
    emailData.to = parseAndValidateEmails(emailData.to as string | string[])
  }
  if (emailData.cc) {
    emailData.cc = parseAndValidateEmails(emailData.cc as string | string[])
  }
  if (emailData.bcc) {
    emailData.bcc = parseAndValidateEmails(emailData.bcc as string | string[])
  }

  // Create the email in the collection with proper typing
  const email = await payload.create({
    collection: collectionSlug,
    data: emailData
  })

  return email as TEmail
}

export default sendEmail
