import type { Payload } from 'payload'

import type { JobPollingConfig } from '../types/index.js'

import { findExistingJobs } from './jobScheduler.js'

export interface PollForJobIdOptions {
  collectionSlug: string
  config?: JobPollingConfig
  emailId: number | string
  logger?: {
    debug: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
  }
  payload: Payload
}

export interface PollForJobIdResult {
  attempts: number
  elapsedTime: number
  jobId: string
}

// Default job polling configuration values
const DEFAULT_JOB_POLLING_CONFIG: Required<JobPollingConfig> = {
  initialDelay: 25,
  maxAttempts: 5,
  maxBackoffDelay: 400,
  maxTotalTime: 3000,
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
  const { emailId, logger, payload } = options

  // Merge user config with defaults
  const config: Required<JobPollingConfig> = {
    ...DEFAULT_JOB_POLLING_CONFIG,
    ...options.config,
  }

  const { initialDelay, maxAttempts, maxBackoffDelay, maxTotalTime } = config
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

    // Query the jobs collection directly rather than reading the email's `jobs`
    // relationship: the afterChange hook intentionally never persists that
    // relationship (it only scopes an admin dropdown via filterOptions), so the
    // stored value stays empty. The auto-scheduled job is, however, queryable by
    // its `input.emailId`, which is exactly what findExistingJobs does.
    const existingJobs = await findExistingJobs(payload, emailId)

    if (existingJobs.totalDocs > 0) {
      const firstJob = existingJobs.docs[0]
      jobId = String(firstJob.id)

      return {
        attempts: attempt + 1,
        elapsedTime: Date.now() - startTime,
        jobId,
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
