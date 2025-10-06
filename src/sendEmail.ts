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

  if (options.template) {
    const { html, text, subject } = await renderTemplate(
      payload,
      options.template.slug,
      options.template.variables || {}
    )

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

  if (options.template) {
    if (!emailData.subject || !emailData.html) {
      throw new Error(`Template rendering failed: template "${options.template.slug}" did not provide required subject and html content`)
    }
  } else {
    if (!emailData.subject || !emailData.html) {
      throw new Error('Fields "subject" and "html" are required when sending direct emails without a template')
    }
  }

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
    emailData.replyTo = validated && validated.length > 0 ? validated[0] : undefined
  }
  if (emailData.from) {
    const validated = parseAndValidateEmails(emailData.from as string | string[])
    emailData.from = validated && validated.length > 0 ? validated[0] : undefined
  }

  emailData.fromName = sanitizeFromName(emailData.fromName as string)

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

  const email = await payload.create({
    collection: collectionSlug,
    data: emailData
  })

  if (!email || typeof email !== 'object' || !email.id) {
    throw new Error('Failed to create email: invalid response from database')
  }

  if (options.processImmediately) {
    const logger = createContextLogger(payload, 'IMMEDIATE')

    if (!payload.jobs) {
      throw new Error('PayloadCMS jobs not configured - cannot process email immediately')
    }

    const maxAttempts = 5
    const initialDelay = 25
    const maxTotalTime = 3000
    const startTime = Date.now()
    let jobId: string | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() - startTime > maxTotalTime) {
        throw new Error(
          `Job polling timed out after ${maxTotalTime}ms for email ${email.id}. ` +
          `The auto-scheduling may have failed or is taking longer than expected.`
        )
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), 400)

      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const emailWithJobs = await payload.findByID({
        collection: collectionSlug,
        id: email.id,
      })

      if (emailWithJobs.jobs && emailWithJobs.jobs.length > 0) {
        const firstJob = Array.isArray(emailWithJobs.jobs) ? emailWithJobs.jobs[0] : emailWithJobs.jobs
        jobId = typeof firstJob === 'string' ? firstJob : String(firstJob.id || firstJob)
        break
      }

      if (attempt >= 2) {
        logger.debug(`Waiting for job creation for email ${email.id}, attempt ${attempt + 1}/${maxAttempts}`)
      }
    }

    if (!jobId) {
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
