import type { Payload, Where } from 'payload'

import { createContextLogger } from './logger.js'

/**
 * Upper bound on how many recent `process-email` jobs are scanned when looking
 * for an existing job for an email. The email id is stored in the `input` JSON
 * column, whose nested path is not filterable on every adapter, so matching
 * happens in JS over a bounded result set rather than loading the entire
 * (potentially large) jobs backlog into memory.
 *
 * This is safe because the lookup is only a best-effort de-duplication hint —
 * the real double-send guard is the atomic `pending` -> `processing` claim at
 * process time (see MailingService.processEmailItem), not this check. A
 * duplicate job is queued near-simultaneously with the original, so it is among
 * the most recent jobs; and finished jobs are excluded in the query (or removed
 * by Payload's default `deleteJobOnComplete`), keeping the live set small.
 * Sorting newest-first means the relevant jobs are always within this window.
 */
const MAX_RECENT_JOBS_SCANNED = 100

/**
 * Finds `process-email` jobs for a given email, newest first.
 *
 * The default payload-jobs collection identifies the task in the top-level
 * `taskSlug` field (not `task` — that is only the argument name passed to
 * `queue()`), so the query filters on `taskSlug`. The email id lives inside the
 * `input` JSON column, whose nested path (`input.emailId`) is not filterable on
 * every database adapter — notably SQLite returns no matches — so it is matched
 * in JS over the most recent {@link MAX_RECENT_JOBS_SCANNED} jobs.
 *
 * With `includeFinished: false`, jobs Payload will never run again are
 * filtered out in the query itself (so retained finished jobs cannot crowd
 * live ones out of the scanned window), using the same fields as Payload's own
 * runner: a set `completedAt` (kept when the host sets
 * `deleteJobOnComplete: false`) or `hasError: true` (set once a job has used
 * up its retries).
 */
export async function findEmailJobs(
  payload: Payload,
  emailId: number | string,
  options: { includeFinished: boolean },
): Promise<{ docs: any[], totalDocs: number }> {
  const normalizedEmailId = String(emailId)

  const taskFilter: Where = {
    taskSlug: {
      equals: 'process-email',
    },
  }
  const where: Where = options.includeFinished
    ? taskFilter
    : {
        and: [
          taskFilter,
          {
            completedAt: {
              exists: false,
            },
          },
          {
            hasError: {
              not_equals: true,
            },
          },
        ],
      }

  const result = await payload.find({
    collection: 'payload-jobs',
    depth: 0,
    limit: MAX_RECENT_JOBS_SCANNED,
    sort: '-createdAt',
    where,
  })

  const docs = result.docs.filter(
    (job: any) => String(job?.input?.emailId) === normalizedEmailId
  )

  return { docs, totalDocs: docs.length }
}

/**
 * Finds the `process-email` jobs for a given email that can still run: not
 * completed and not failed for good (see {@link findEmailJobs}). A job that is
 * queued, waiting for its `waitUntil`, retrying or currently running counts.
 * ensureEmailJob uses this to avoid queueing a duplicate, so an email set back
 * to `pending` gets a new job even when its earlier jobs are kept as history.
 */
export async function findExistingJobs(
  payload: Payload,
  emailId: number | string
): Promise<{ docs: any[], totalDocs: number }> {
  return findEmailJobs(payload, emailId, { includeFinished: false })
}

/**
 * Ensures a processing job exists for an email
 * Creates one if it doesn't exist, or returns existing job IDs
 *
 * Duplicate prevention works by querying for existing process-email jobs
 * before queueing a new one (see findExistingJobs). There is no database-level
 * uniqueness constraint on the payload-jobs collection, because this plugin
 * does not own or configure that collection. As a result this check is NOT
 * fully atomic: two calls running concurrently can both observe "no existing
 * job" and each create one. The pre-check eliminates duplicates in the common
 * sequential case and greatly narrows the race window, but cannot close it
 * entirely. The post-create catch block below provides best-effort cleanup by
 * returning any already-existing jobs instead of surfacing an error.
 */
export async function ensureEmailJob(
  payload: Payload,
  emailId: number | string,
  options?: {
    queueName?: string
    scheduledAt?: Date | string
  }
): Promise<{ created: boolean, jobIds: (number | string)[] }> {
  if (!payload.jobs) {
    throw new Error('PayloadCMS jobs not configured - cannot create email job')
  }

  const normalizedEmailId = String(emailId)
  const mailingContext = (payload as any).mailing
  const queueName = options?.queueName || mailingContext?.config?.queue || 'default'

  const logger = createContextLogger(payload, 'JOB_SCHEDULER')

  // Check for an existing job before queueing a new one. This is the primary
  // duplicate-prevention mechanism, since there is no DB uniqueness constraint
  // to fall back on. It is not race-free (see the function doc comment), but it
  // prevents duplicates for the common sequential case.
  const preExistingJobs = await findExistingJobs(payload, normalizedEmailId)
  if (preExistingJobs.totalDocs > 0) {
    logger.debug(`Using existing jobs for email ${normalizedEmailId}: ${preExistingJobs.docs.map(j => j.id).join(', ')}`)
    return {
      created: false,
      jobIds: preExistingJobs.docs.map(job => job.id)
    }
  }

  try {
    const job = await payload.jobs.queue({
      input: {
        emailId: normalizedEmailId
      },
      queue: queueName,
      task: 'process-email',
      waitUntil: options?.scheduledAt ? new Date(options.scheduledAt) : undefined
    })

    logger.info(`Auto-scheduled processing job ${job.id} for email ${normalizedEmailId}`)

    return {
      created: true,
      jobIds: [job.id]
    }
  } catch (createError) {

    // Queueing failed. Defense-in-depth: if a concurrent call slipped past the
    // pre-check above and created a job in the meantime, re-query and return it
    // instead of propagating the error. This narrows (but does not close) the
    // race window left open by the absence of a DB uniqueness constraint.
    const existingJobs = await findExistingJobs(payload, normalizedEmailId)

    if (existingJobs.totalDocs > 0) {
      logger.debug(`Using existing jobs for email ${normalizedEmailId}: ${existingJobs.docs.map(j => j.id).join(', ')}`)
      return {
        created: false,
        jobIds: existingJobs.docs.map(job => job.id)
      }
    }

    // No existing jobs found - this is a genuine queueing error.
    const errorMessage = String(createError)
    logger.error(`Job creation error for email ${normalizedEmailId}: ${errorMessage}`)
    throw new Error(`Failed to create job for email ${normalizedEmailId}: ${errorMessage}`)
  }
}

/**
 * Updates an email document to include job IDs in the relationship field
 */
export async function updateEmailJobRelationship(
  payload: Payload,
  emailId: number | string,
  jobIds: (number | string)[],
  collectionSlug: string = 'emails'
): Promise<void> {
  try {
    const normalizedEmailId = String(emailId)
    const normalizedJobIds = jobIds.map(id => String(id))

    // Get current jobs to avoid overwriting
    const currentEmail = await payload.findByID({
      id: normalizedEmailId,
      collection: collectionSlug,
    })

    // Extract IDs from job objects or use the value directly if it's already an ID
    // Jobs can be populated (objects with id field) or just IDs (strings/numbers)
    const currentJobs = (currentEmail.jobs || []).map((job: any) =>
      typeof job === 'object' && job !== null && job.id ? String(job.id) : String(job)
    )
    const allJobs = [...new Set([...currentJobs, ...normalizedJobIds])] // Deduplicate with normalized strings

    await payload.update({
      id: normalizedEmailId,
      collection: collectionSlug,
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