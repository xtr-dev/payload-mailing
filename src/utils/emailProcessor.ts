import type { Payload } from 'payload'

import { createContextLogger } from './logger.js'

/**
 * Processes a single email by ID using the mailing service
 * @param payload Payload instance
 * @param emailId The ID of the email to process
 * @returns Promise that resolves when email is processed
 */
export async function processEmailById(payload: Payload, emailId: string): Promise<void> {
  // Get mailing context from payload
  const mailingContext = (payload as any).mailing

  if (!mailingContext) {
    throw new Error(
      'Mailing plugin not found on payload instance. ' +
      'Ensure the mailingPlugin is properly configured in your Payload config plugins array.'
    )
  }

  if (!mailingContext.service) {
    throw new Error(
      'Mailing service not available. ' +
      'The plugin may not have completed initialization. ' +
      'Check that email configuration is properly set up in your Payload config.'
    )
  }

  // Process the specific email
  await mailingContext.service.processEmailItem(emailId)
}

/**
 * Processes a job immediately by finding and executing it
 * @param payload Payload instance
 * @param jobId The ID of the job to run immediately
 * @returns Promise that resolves when job is processed
 */
export async function processJobById(payload: Payload, jobId: string): Promise<void> {
  if (!payload.jobs) {
    throw new Error('PayloadCMS jobs not configured - cannot process job immediately')
  }

  try {
    // Run a specific job by its ID. `jobs.run` only picks up jobs from the
    // `default` queue unless told otherwise, so `allQueues` is required for
    // emails queued on the plugin's configured queue or a per-send `queue`
    // override; the `where` clause still limits the run to this one job.
    await payload.jobs.run({
      allQueues: true,
      where: {
        id: {
          equals: jobId
        }
      }
    })
  } catch (error) {
    const logger = createContextLogger(payload, 'PROCESSOR')
    logger.error(`Job ${jobId} execution failed:`, error)
    throw new Error(`Failed to process job ${jobId}: ${String(error)}`)
  }
}

/**
 * Sends due `pending` emails (`processEmails`), then retries `failed` emails
 * that still have attempts left (`retryFailedEmails` with
 * `onlyWithAttemptsLeft`). An email that used up its `retryAttempts` stays
 * `failed` and is skipped, so this is safe to call on a schedule. `failed`
 * emails below the limit only exist when `retryAttempts` was raised after they
 * failed. To give permanently failed emails another try anyway, call
 * `retryFailedEmails(payload)` yourself.
 * @param payload Payload instance
 * @returns Promise that resolves when all emails are processed
 */
export async function processAllEmails(payload: Payload): Promise<void> {
  // Get mailing context from payload
  const mailingContext = (payload as any).mailing

  if (!mailingContext) {
    throw new Error(
      'Mailing plugin not found on payload instance. ' +
      'Ensure the mailingPlugin is properly configured in your Payload config plugins array.'
    )
  }

  if (!mailingContext.service) {
    throw new Error(
      'Mailing service not available. ' +
      'The plugin may not have completed initialization. ' +
      'Check that email configuration is properly set up in your Payload config.'
    )
  }

  // Process pending emails first
  await mailingContext.service.processEmails()

  // Then retry failed emails, but never one that already used up its attempts:
  // on a schedule that would re-send a permanently failing email forever.
  await mailingContext.service.retryFailedEmails({ onlyWithAttemptsLeft: true })
}