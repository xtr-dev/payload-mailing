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
  // The hooks will automatically create and populate the job relationship
  const email = await payload.create({
    collection: collectionSlug,
    data: emailData
  })

  // Validate that the created email has the expected structure
  if (!email || typeof email !== 'object' || !email.id) {
    throw new Error('Failed to create email: invalid response from database')
  }

  // If processImmediately is true, get the job from the relationship and process it now
  if (options.processImmediately) {
    if (!payload.jobs) {
      throw new Error('PayloadCMS jobs not configured - cannot process email immediately')
    }

    // Poll for the job with exponential backoff
    // This handles the async nature of hooks and ensures we wait for job creation
    const maxAttempts = 10
    const initialDelay = 50 // Start with 50ms
    let jobId: string | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Calculate delay with exponential backoff (50ms, 100ms, 200ms, 400ms...)
      // Cap at 2 seconds per attempt
      const delay = Math.min(initialDelay * Math.pow(2, attempt), 2000)

      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Refetch the email to check for jobs
      const emailWithJobs = await payload.findByID({
        collection: collectionSlug,
        id: email.id,
      })

      if (emailWithJobs.jobs && emailWithJobs.jobs.length > 0) {
        // Job found! Get the first job ID (should only be one for a new email)
        jobId = Array.isArray(emailWithJobs.jobs)
          ? String(emailWithJobs.jobs[0])
          : String(emailWithJobs.jobs)
        break
      }

      // Log on later attempts to help with debugging
      if (attempt >= 3) {
        console.log(`Waiting for job creation for email ${email.id}, attempt ${attempt + 1}/${maxAttempts}`)
      }
    }

    if (!jobId) {
      throw new Error(
        `No processing job found for email ${email.id} after ${maxAttempts} attempts. ` +
        `The auto-scheduling may have failed or is taking longer than expected.`
      )
    }

    try {
      await processJobById(payload, jobId)
    } catch (error) {
      throw new Error(`Failed to process email ${email.id} immediately: ${String(error)}`)
    }
  }

  return email as TEmail
}

export default sendEmail
