import { processEmailsJob } from './processEmailsTask.js'
import { processEmailJob } from './processEmailJob.js'

/**
 * All mailing-related jobs that get registered with Payload
 *
 * Note: The sendEmailJob has been removed as each email now gets its own individual processEmailJob
 */
export const mailingJobs = [
  processEmailsJob, // Kept for backward compatibility and batch processing if needed
  processEmailJob,  // New individual email processing job
]

// Re-export everything from individual job files
export * from './processEmailsTask.js'
export * from './processEmailJob.js'
