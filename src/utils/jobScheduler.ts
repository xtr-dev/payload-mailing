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

  // Check for existing jobs first
  const existingJobs = await findExistingJobs(payload, emailId)

  if (existingJobs.totalDocs > 0) {
    // Return existing job IDs
    return {
      jobIds: existingJobs.docs.map(job => job.id),
      created: false
    }
  }

  // No existing job, create a new one
  const mailingContext = (payload as any).mailing
  const queueName = options?.queueName || mailingContext?.config?.queue || 'default'

  const job = await payload.jobs.queue({
    queue: queueName,
    task: 'process-email',
    input: {
      emailId: String(emailId)
    },
    // If scheduled, set the waitUntil date
    waitUntil: options?.scheduledAt ? new Date(options.scheduledAt) : undefined
  })

  console.log(`Auto-scheduled processing job ${job.id} for email ${emailId}`)

  return {
    jobIds: [job.id],
    created: true
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
    // Get current jobs to avoid overwriting
    const currentEmail = await payload.findByID({
      collection: collectionSlug,
      id: emailId,
    })

    const currentJobs = currentEmail.jobs || []
    const allJobs = [...new Set([...currentJobs, ...jobIds])] // Deduplicate

    await payload.update({
      collection: collectionSlug,
      id: emailId,
      data: {
        jobs: allJobs
      }
    })
  } catch (error) {
    console.error(`Failed to update email ${emailId} with job relationship:`, error)
    throw error
  }
}