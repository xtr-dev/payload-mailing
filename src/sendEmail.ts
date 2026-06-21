import type { Payload } from 'payload'

import type { BaseEmailDocument } from './types/index.js'

import { processJobById } from './utils/emailProcessor.js'
import { getMailing, parseAndValidateEmails, renderTemplateWithId, sanitizeFromName } from './utils/helpers.js'
import { pollForJobId } from './utils/jobPolling.js'
import { createContextLogger } from './utils/logger.js'

// Options for sending emails
export interface SendEmailOptions<T extends BaseEmailDocument = BaseEmailDocument> {
  // Common options
  collectionSlug?: string // defaults to 'emails'
  // Direct email data
  data?: Partial<T>
  processImmediately?: boolean // if true, creates job and processes it immediately
  queue?: string // queue name for the job, defaults to mailing config queue
  // Template-based email
  template?: {
    slug: string
    variables?: Record<string, any>
  }
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
    // Look up and render the template in a single operation to avoid duplicate lookups
    const { html, subject, templateId, text } = await renderTemplateWithId(
      payload,
      options.template.slug,
      options.template.variables || {}
    )

    emailData = {
      ...emailData,
      html,
      subject,
      template: templateId,
      text,
      variables: options.template.variables || {},
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

    // Poll for the job ID using configurable polling mechanism
    const { jobId } = await pollForJobId({
      collectionSlug,
      config: mailingConfig.jobPolling,
      emailId: email.id,
      logger,
      payload,
    })

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
