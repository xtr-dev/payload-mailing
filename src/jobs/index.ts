import { processEmailsJob } from './processEmailsJob.js'
import { sendEmailJob } from './sendEmailTask.js'

/**
 * All mailing-related jobs that get registered with Payload
 */
export const mailingJobs = [
  processEmailsJob,
  sendEmailJob,
]

// Re-export everything from individual job files
export * from './processEmailsJob.js'
export * from './sendEmailTask.js'
