import type { Payload } from 'payload'

import type { BaseEmailDocument } from './types/index.js'

import { processJobById } from './utils/emailProcessor.js'
import { getMailing, parseAndValidateEmails, renderTemplateWithId, sanitizeFromName } from './utils/helpers.js'
import { ensureEmailJob } from './utils/jobScheduler.js'
import { createContextLogger } from './utils/logger.js'

// The shape sendEmail's `data` option actually accepts: recipient/sender fields as
// the caller writes them (a single address or a comma-separated/array list), not the
// normalized string[] / single-string shape BaseEmailDocument stores. sendEmail runs
// each of these through parseAndValidateEmails before the row is created, so the
// public input type must be wider than the stored document type it feeds into.
type SendEmailData<T extends BaseEmailDocument> = {
  bcc?: null | string | string[]
  cc?: null | string | string[]
  from?: null | string | string[]
  replyTo?: null | string | string[]
  to?: string | string[]
} & Omit<Partial<T>, 'bcc' | 'cc' | 'from' | 'replyTo' | 'to'>

/**
 * Thrown by `sendEmail` when `processImmediately` is set and the email row was
 * created and its processing job queued, but the email was not sent inline:
 * the delivery itself failed (e.g. the SMTP server is down), or the job could
 * not be run.
 *
 * The email is not lost. After a failed delivery it is back to `pending` with a
 * retry job that the regular queue run (or `processEmails`) picks up once
 * `retryDelay` has passed; only when that was its last allowed attempt
 * (`retryAttempts: 1`) is it `failed`. Callers that only need "accepted for
 * delivery" can catch this error and treat the send as queued. Validation,
 * template and create errors stay plain `Error`s, so they still mean no email
 * was created.
 */
export class ImmediateProcessingError<TEmail extends BaseEmailDocument = BaseEmailDocument> extends Error {
  /**
   * The email document that was created, as it is after the inline attempt:
   * `status` tells whether it waits for a retry (`pending`) or has given up
   * (`failed`), and `error` holds the delivery error.
   */
  readonly email: TEmail
  /** ID of the queued job that was run inline. */
  readonly jobId: string

  constructor(email: TEmail, jobId: string, cause: unknown) {
    super(`Failed to process email ${email.id} immediately: ${String(cause)}`, { cause })
    this.name = 'ImmediateProcessingError'
    this.email = email
    this.jobId = jobId
  }
}

// Options for sending emails
export interface SendEmailOptions<T extends BaseEmailDocument = BaseEmailDocument> {
  // Common options
  collectionSlug?: string // defaults to 'emails'
  // Direct email data
  data?: SendEmailData<T>
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

  // parseAndValidateEmails silently collapses a whitespace/comma-only string (e.g.
  // " , ") to an empty array rather than throwing, since it has no invalid-looking
  // candidates to reject. The `!emailData.to` check above already ran against the
  // raw (still-truthy) string, so re-check non-emptiness here, after normalization,
  // or a caller-supplied garbage `to` reaches payload.create with zero recipients.
  if (!emailData.to || (emailData.to as string[]).length === 0) {
    throw new Error('Field "to" is required for sending emails')
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

  // Pass a context object into the create operation. The Emails afterChange hook
  // runs synchronously within this call and writes the IDs of the job(s) it
  // queues onto this same object (Payload assigns `req.context` to the object we
  // pass here by reference), letting us run the job below without polling for it.
  // The afterChange hook queues ordinary sends, so carry the per-send queue
  // override through the same context object it uses to hand back job IDs.
  const createContext: { emailJobIds?: (number | string)[], emailQueueName?: string } = {}
  if (options.queue) {
    createContext.emailQueueName = options.queue
  }

  const email = await payload.create({
    collection: collectionSlug,
    context: createContext,
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

    // Resolve the processing job without polling. The job is queued
    // synchronously while `payload.create` runs its afterChange hook, which hands
    // the job ID(s) back through the shared request context — so the ID is
    // already available here. If the context is empty (e.g. a custom email
    // collection that doesn't run the plugin's hook, or an email created in a
    // non-pending status), queue the job directly; `ensureEmailJob` returns the
    // new job ID without any lookup. Both paths obtain the ID from the queue
    // operation itself rather than querying for it, which also avoids the
    // payload-jobs `input.emailId` lookup that some database adapters can't run.
    const handedOffJobIds = createContext.emailJobIds
    let jobId = Array.isArray(handedOffJobIds) && handedOffJobIds.length > 0
      ? String(handedOffJobIds[0])
      : undefined

    if (!jobId) {
      const { jobIds } = await ensureEmailJob(payload, email.id, {
        queueName: options.queue,
        scheduledAt: emailData.scheduledAt as Date | string | undefined,
      })
      jobId = String(jobIds[0])
    }

    try {
      await processJobById(payload, jobId)
    } catch (error) {
      logger.error(`Failed to process email ${email.id} immediately:`, error)
      throw new ImmediateProcessingError(email as TEmail, jobId, error)
    }

    // A resolved job run does not mean the email went out: Payload records a
    // failing task on the job instead of rejecting, and the mailing service
    // turns a delivery error into a `pending` email with a delayed retry job.
    // The email's own status is the only reliable outcome, so read it back.
    let processed: TEmail
    try {
      processed = await payload.findByID({
        id: email.id,
        collection: collectionSlug,
      }) as TEmail
    } catch (error) {
      logger.error(`Could not confirm that email ${email.id} was sent immediately:`, error)
      throw new ImmediateProcessingError(email as TEmail, jobId, error)
    }

    // An email scheduled for later keeps its job waiting until `scheduledAt`
    // (the job runner skips a job whose `waitUntil` is in the future), so the
    // inline run leaves it untouched. That is the requested outcome, not a
    // failed send.
    const scheduledFor = processed.scheduledAt ? new Date(processed.scheduledAt).getTime() : NaN
    if (processed.status === 'pending' && !processed.attempts && scheduledFor > Date.now()) {
      logger.debug(`Email ${email.id} is scheduled for ${String(processed.scheduledAt)}; not sent immediately`)
      return processed
    }

    if (processed.status !== 'sent') {
      const reason = processed.error
        ? processed.error
        : `the email was not sent by the inline job run (status: ${processed.status})`
      logger.error(`Email ${email.id} was not sent immediately: ${reason}`)
      throw new ImmediateProcessingError(processed, jobId, new Error(reason))
    }

    logger.debug(`Successfully processed email ${email.id} immediately`)
    // Return the email as it is after the send (`status: 'sent'`, `sentAt`)
    // rather than the `pending` row from before the job ran.
    return processed
  }

  return email as TEmail
}

export default sendEmail
