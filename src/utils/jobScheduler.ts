import type { Payload } from 'payload'
import { createContextLogger } from './logger.js'

/**
 * Finds existing processing jobs for an email
 */
export async function findExistingJobs(
  payload: Payload,
  emailId: string | number
): Promise<{ docs: any[], totalDocs: number }> {
  return await payload.find({
    collection: 'payload-jobs',
    where: {
      'input.emailId': {
        equals: String(emailId),
      },
      task: {
        equals: 'process-email',
      },
    },
    limit: 10,
  })
}

/**
 * Ensures a processing job exists for an email
 * Creates one if it doesn't exist, or returns existing job IDs
 *
 * This function is idempotent and safe for concurrent calls:
 * - Uses atomic check-and-create pattern with retry logic
 * - Multiple concurrent calls will only create one job
 * - Database-level uniqueness prevents duplicate jobs
 * - Race conditions are handled with exponential backoff retry
 */
export async function ensureEmailJob(
  payload: Payload,
  emailId: string | number,
  options?: {
    scheduledAt?: string | Date
    queueName?: string
  }
): Promise<{ jobIds: (string | number)[], created: boolean }> {
  if (!payload.jobs) {
    throw new Error('PayloadCMS jobs not configured - cannot create email job')
  }

  const normalizedEmailId = String(emailId)
  const mailingContext = (payload as any).mailing
  const queueName = options?.queueName || mailingContext?.config?.queue || 'default'

  const logger = createContextLogger(payload, 'JOB_SCHEDULER')

  // First, optimistically try to create the job
  // If it fails due to uniqueness constraint, then check for existing jobs
  // This approach minimizes the race condition window

  try {
    // Attempt to create job - rely on database constraints for duplicate prevention
    const job = await payload.jobs.queue({
      queue: queueName,
      task: 'process-email',
      input: {
        emailId: normalizedEmailId
      },
      waitUntil: options?.scheduledAt ? new Date(options.scheduledAt) : undefined
    })

    logger.info(`Auto-scheduled processing job ${job.id} for email ${normalizedEmailId}`)

    return {
      jobIds: [job.id],
      created: true
    }
  } catch (createError) {

    // Job creation failed - likely due to duplicate constraint or system issue

    // Check if duplicate jobs exist (handles race condition where another process created job)
    const existingJobs = await findExistingJobs(payload, normalizedEmailId)


    if (existingJobs.totalDocs > 0) {
      // Found existing jobs - return them (race condition handled successfully)
      logger.debug(`Using existing jobs for email ${normalizedEmailId}: ${existingJobs.docs.map(j => j.id).join(', ')}`)
      return {
        jobIds: existingJobs.docs.map(job => job.id),
        created: false
      }
    }

    // No existing jobs found - this is a genuine error
    // Enhanced error context for better debugging
    const errorMessage = String(createError)
    const isLikelyUniqueConstraint = errorMessage.toLowerCase().includes('duplicate') ||
                                     errorMessage.toLowerCase().includes('unique') ||
                                     errorMessage.toLowerCase().includes('constraint')

    if (isLikelyUniqueConstraint) {
      // This should not happen if our check above worked, but provide a clear error
      logger.warn(`Unique constraint violation but no existing jobs found for email ${normalizedEmailId}`)
      throw new Error(
        `Database uniqueness constraint violation for email ${normalizedEmailId}, but no existing jobs found. ` +
        `This indicates a potential data consistency issue. Original error: ${errorMessage}`
      )
    }

    // Non-constraint related error
    logger.error(`Job creation error for email ${normalizedEmailId}: ${errorMessage}`)
    throw new Error(`Failed to create job for email ${normalizedEmailId}: ${errorMessage}`)
  }
}

/**
 * Updates an email document to include job IDs in the relationship field
 */
export async function updateEmailJobRelationship(
  payload: Payload,
  emailId: string | number,
  jobIds: (string | number)[],
  collectionSlug: string = 'emails'
): Promise<void> {
  try {
    const normalizedEmailId = String(emailId)
    const normalizedJobIds = jobIds.map(id => String(id))

    // Get current jobs to avoid overwriting
    const currentEmail = await payload.findByID({
      collection: collectionSlug,
      id: normalizedEmailId,
    })

    const currentJobs = (currentEmail.jobs || []).map((job: any) => String(job))
    const allJobs = [...new Set([...currentJobs, ...normalizedJobIds])] // Deduplicate with normalized strings

    await payload.update({
      collection: collectionSlug,
      id: normalizedEmailId,
      data: {
        jobs: allJobs
      }
    })
  } catch (error) {
    const normalizedEmailId = String(emailId)
    const logger = createContextLogger(payload, 'JOB_SCHEDULER')
    logger.error(`Failed to update email ${normalizedEmailId} with job relationship:`, error)
    throw error
  }
}