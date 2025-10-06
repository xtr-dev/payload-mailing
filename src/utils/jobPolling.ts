import { Payload } from 'payload'
import { JobPollingConfig } from '../types/index.js'

export interface PollForJobIdOptions {
  payload: Payload
  collectionSlug: string
  emailId: string | number
  config?: JobPollingConfig
  logger?: {
    debug: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
  }
}

export interface PollForJobIdResult {
  jobId: string
  attempts: number
  elapsedTime: number
}

// Default job polling configuration values
const DEFAULT_JOB_POLLING_CONFIG: Required<JobPollingConfig> = {
  maxAttempts: 5,
  initialDelay: 25,
  maxTotalTime: 3000,
  maxBackoffDelay: 400,
}

/**
 * Polls for a job ID associated with an email document using exponential backoff.
 * This utility handles the complexity of waiting for auto-scheduled jobs to be created.
 *
 * The polling mechanism uses exponential backoff with configurable parameters:
 * - Starts with an initial delay and doubles on each retry
 * - Caps individual delays at maxBackoffDelay
 * - Enforces a maximum total polling time
 *
 * @param options - Polling options including payload, collection, email ID, and config
 * @returns Promise resolving to job ID and timing information
 * @throws Error if job is not found within the configured limits
 */
export const pollForJobId = async (options: PollForJobIdOptions): Promise<PollForJobIdResult> => {
  const { payload, collectionSlug, emailId, logger } = options

  // Merge user config with defaults
  const config: Required<JobPollingConfig> = {
    ...DEFAULT_JOB_POLLING_CONFIG,
    ...options.config,
  }

  const { maxAttempts, initialDelay, maxTotalTime, maxBackoffDelay } = config
  const startTime = Date.now()
  let jobId: string | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const elapsedTime = Date.now() - startTime

    // Check if we've exceeded the maximum total polling time
    if (elapsedTime > maxTotalTime) {
      throw new Error(
        `Job polling timed out after ${maxTotalTime}ms for email ${emailId}. ` +
        `The auto-scheduling may have failed or is taking longer than expected.`
      )
    }

    // Calculate exponential backoff delay, capped at maxBackoffDelay
    const delay = Math.min(initialDelay * Math.pow(2, attempt), maxBackoffDelay)

    // Wait before checking (skip on first attempt)
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Fetch the email document to check for associated jobs
    const emailWithJobs = await payload.findByID({
      collection: collectionSlug,
      id: emailId,
    })

    // Check if jobs array exists and has entries
    if (emailWithJobs.jobs && emailWithJobs.jobs.length > 0) {
      const firstJob = Array.isArray(emailWithJobs.jobs) ? emailWithJobs.jobs[0] : emailWithJobs.jobs
      jobId = typeof firstJob === 'string' ? firstJob : String(firstJob.id || firstJob)

      return {
        jobId,
        attempts: attempt + 1,
        elapsedTime: Date.now() - startTime,
      }
    }

    // Log progress for attempts after the second try
    if (attempt >= 2 && logger) {
      logger.debug(`Waiting for job creation for email ${emailId}, attempt ${attempt + 1}/${maxAttempts}`)
    }
  }

  // If we reach here, job was not found
  const elapsedTime = Date.now() - startTime
  const timeoutMsg = elapsedTime >= maxTotalTime
  const errorType = timeoutMsg ? 'POLLING_TIMEOUT' : 'JOB_NOT_FOUND'
  const baseMessage = timeoutMsg
    ? `Job polling timed out after ${maxTotalTime}ms for email ${emailId}`
    : `No processing job found for email ${emailId} after ${maxAttempts} attempts (${elapsedTime}ms)`

  throw new Error(
    `${errorType}: ${baseMessage}. ` +
    `This indicates the email was created but job auto-scheduling failed. ` +
    `The email exists in the database but immediate processing cannot proceed. ` +
    `You may need to: 1) Check job queue configuration, 2) Verify database hooks are working, ` +
    `3) Process the email later using processEmailById('${emailId}').`
  )
}
