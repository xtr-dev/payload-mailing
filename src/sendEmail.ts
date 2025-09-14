import { Payload } from 'payload'
import { getMailing, renderTemplate, parseAndValidateEmails } from './utils/helpers.js'
import { BaseEmailDocument } from './types/index.js'
import { processJobById } from './utils/emailProcessor.js'

// Options for sending emails
export interface SendEmailOptions<T extends BaseEmailDocument = BaseEmailDocument> {
  // Template-based email
  template?: {
    slug: string
    variables?: Record<string, any>
  }
  // Direct email data
  data?: Partial<T>
  // Common options
  collectionSlug?: string // defaults to 'emails'
  processImmediately?: boolean // if true, creates job and processes it immediately
  queue?: string // queue name for the job, defaults to mailing config queue
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
export const sendEmail = async <TEmail extends BaseEmailDocument = BaseEmailDocument>(
  payload: Payload,
  options: SendEmailOptions<TEmail>
): Promise<TEmail> => {
  const mailingConfig = getMailing(payload)
  const collectionSlug = options.collectionSlug || mailingConfig.collections.emails || 'emails'

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
  if (emailData.replyTo) {
    const validated = parseAndValidateEmails(emailData.replyTo as string | string[])
    // replyTo should be a single email, so take the first one if array
    emailData.replyTo = validated && validated.length > 0 ? validated[0] : undefined
  }
  if (emailData.from) {
    const validated = parseAndValidateEmails(emailData.from as string | string[])
    // from should be a single email, so take the first one if array
    emailData.from = validated && validated.length > 0 ? validated[0] : undefined
  }

  // Sanitize fromName to prevent header injection
  if (emailData.fromName) {
    emailData.fromName = emailData.fromName
      .trim()
      // Remove/replace newlines and carriage returns to prevent header injection
      .replace(/[\r\n]/g, ' ')
      // Remove control characters (except space and printable characters)
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Note: We don't escape quotes here as that's handled in MailingService
  }

  // Normalize Date objects to ISO strings for consistent database storage
  if (emailData.scheduledAt instanceof Date) {
    emailData.scheduledAt = emailData.scheduledAt.toISOString()
  }
  if (emailData.sentAt instanceof Date) {
    emailData.sentAt = emailData.sentAt.toISOString()
  }
  if (emailData.lastAttemptAt instanceof Date) {
    emailData.lastAttemptAt = emailData.lastAttemptAt.toISOString()
  }
  if (emailData.createdAt instanceof Date) {
    emailData.createdAt = emailData.createdAt.toISOString()
  }
  if (emailData.updatedAt instanceof Date) {
    emailData.updatedAt = emailData.updatedAt.toISOString()
  }

  // Create the email in the collection with proper typing
  const email = await payload.create({
    collection: collectionSlug,
    data: emailData
  })

  // Validate that the created email has the expected structure
  if (!email || typeof email !== 'object' || !email.id) {
    throw new Error('Failed to create email: invalid response from database')
  }

  // Create an individual job for this email
  const queueName = options.queue || mailingConfig.queue || 'default'

  if (!payload.jobs) {
    if (options.processImmediately) {
      throw new Error('PayloadCMS jobs not configured - cannot process email immediately')
    } else {
      console.warn('PayloadCMS jobs not configured - emails will not be processed automatically')
      return email as TEmail
    }
  }

  let jobId: string
  try {
    const job = await payload.jobs.queue({
      queue: queueName,
      task: 'process-email',
      input: {
        emailId: String(email.id)
      },
      // If scheduled, set the waitUntil date
      waitUntil: emailData.scheduledAt ? new Date(emailData.scheduledAt) : undefined
    })

    jobId = String(job.id)
  } catch (error) {
    // Clean up the orphaned email since job creation failed
    try {
      await payload.delete({
        collection: collectionSlug,
        id: email.id
      })
    } catch (deleteError) {
      console.error(`Failed to clean up orphaned email ${email.id} after job creation failure:`, deleteError)
    }

    // Throw the original job creation error
    const errorMsg = `Failed to create processing job for email ${email.id}: ${String(error)}`
    throw new Error(errorMsg)
  }

  // If processImmediately is true, process the job now
  if (options.processImmediately) {
    try {
      await processJobById(payload, jobId)
    } catch (error) {
      // For immediate processing failures, we could consider cleanup, but the job exists and could be retried later
      // So we'll leave the email and job in place for potential retry
      throw new Error(`Failed to process email ${email.id} immediately: ${String(error)}`)
    }
  }

  return email as TEmail
}

export default sendEmail
