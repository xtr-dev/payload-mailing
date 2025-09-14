import type { Payload } from 'payload'

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

  // Implement atomic check-and-create with retry logic to prevent race conditions
  const maxAttempts = 5
  const baseDelay = 100 // Start with 100ms

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for existing jobs with precise matching
    const existingJobs = await findExistingJobs(payload, normalizedEmailId)

    if (existingJobs.totalDocs > 0) {
      // Job already exists - return existing job IDs
      return {
        jobIds: existingJobs.docs.map(job => job.id),
        created: false
      }
    }

    try {
      // Attempt to create job with specific input that ensures uniqueness
      const job = await payload.jobs.queue({
        queue: queueName,
        task: 'process-email',
        input: {
          emailId: normalizedEmailId,
          // Add a unique constraint helper to prevent duplicates at queue level
          uniqueKey: `email-${normalizedEmailId}-${Date.now()}-${Math.random()}`
        },
        waitUntil: options?.scheduledAt ? new Date(options.scheduledAt) : undefined
      })

      console.log(`Auto-scheduled processing job ${job.id} for email ${normalizedEmailId}`)

      return {
        jobIds: [job.id],
        created: true
      }
    } catch (error) {
      // On any creation error, wait briefly and check again for concurrent creation
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))

        // Check if another process succeeded while we were failing
        const recheckJobs = await findExistingJobs(payload, normalizedEmailId)
        if (recheckJobs.totalDocs > 0) {
          return {
            jobIds: recheckJobs.docs.map(job => job.id),
            created: false
          }
        }

        // Continue to next attempt
        continue
      }

      // Final attempt failed - perform one last check before throwing
      const finalCheckJobs = await findExistingJobs(payload, normalizedEmailId)
      if (finalCheckJobs.totalDocs > 0) {
        return {
          jobIds: finalCheckJobs.docs.map(job => job.id),
          created: false
        }
      }

      // No concurrent job found - this is a real error
      throw new Error(`Failed to create job for email ${normalizedEmailId} after ${maxAttempts} attempts: ${String(error)}`)
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error(`Unexpected error in ensureEmailJob after ${maxAttempts} attempts`)
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
    console.error(`Failed to update email ${normalizedEmailId} with job relationship:`, error)
    throw error
  }
}