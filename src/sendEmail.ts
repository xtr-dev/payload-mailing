import { Payload } from 'payload'
import { getMailing, renderTemplate, parseAndValidateEmails, sanitizeFromName } from './utils/helpers.js'
import { BaseEmailDocument } from './types/index.js'
import { processJobById } from './utils/emailProcessor.js'
import { createContextLogger } from './utils/logger.js'

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
  emailData.fromName = sanitizeFromName(emailData.fromName as string)

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
    const logger = createContextLogger(payload, 'IMMEDIATE')

    if (!payload.jobs) {
      throw new Error('PayloadCMS jobs not configured - cannot process email immediately')
    }

    // Poll for the job with optimized backoff and timeout protection
    // This handles the async nature of hooks and ensures we wait for job creation
    const maxAttempts = 5 // Reduced from 10 to minimize delay
    const initialDelay = 25 // Reduced from 50ms for faster response
    const maxTotalTime = 3000 // 3 second total timeout
    const startTime = Date.now()
    let jobId: string | undefined


    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check total timeout before continuing
      if (Date.now() - startTime > maxTotalTime) {
        throw new Error(
          `Job polling timed out after ${maxTotalTime}ms for email ${email.id}. ` +
          `The auto-scheduling may have failed or is taking longer than expected.`
        )
      }

      // Calculate delay with exponential backoff (25ms, 50ms, 100ms, 200ms, 400ms)
      // Cap at 400ms per attempt for better responsiveness
      const delay = Math.min(initialDelay * Math.pow(2, attempt), 400)

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
        const firstJob = Array.isArray(emailWithJobs.jobs) ? emailWithJobs.jobs[0] : emailWithJobs.jobs
        jobId = typeof firstJob === 'string' ? firstJob : String(firstJob.id || firstJob)
        break
      }

      // Log on later attempts to help with debugging (reduced threshold)
      if (attempt >= 1) {
        if (attempt >= 2) {
          logger.debug(`Waiting for job creation for email ${email.id}, attempt ${attempt + 1}/${maxAttempts}`)
        }
      }
    }

    if (!jobId) {
      // Distinguish between different failure scenarios for better error handling
      const timeoutMsg = Date.now() - startTime >= maxTotalTime
      const errorType = timeoutMsg ? 'POLLING_TIMEOUT' : 'JOB_NOT_FOUND'

      const baseMessage = timeoutMsg
        ? `Job polling timed out after ${maxTotalTime}ms for email ${email.id}`
        : `No processing job found for email ${email.id} after ${maxAttempts} attempts (${Date.now() - startTime}ms)`

      throw new Error(
        `${errorType}: ${baseMessage}. ` +
        `This indicates the email was created but job auto-scheduling failed. ` +
        `The email exists in the database but immediate processing cannot proceed. ` +
        `You may need to: 1) Check job queue configuration, 2) Verify database hooks are working, ` +
        `3) Process the email later using processEmailById('${email.id}').`
      )
    }

    try {
      await processJobById(payload, jobId)
      logger.debug(`Successfully processed email ${email.id} immediately`)
    } catch (error) {
      logger.error(`Failed to process email ${email.id} immediately:`, error)
      throw new Error(`Failed to process email ${email.id} immediately: ${String(error)}`)
    }
  }

  return email as TEmail
}

export default sendEmail
