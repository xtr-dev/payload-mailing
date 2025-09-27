import { processEmailJob } from './processEmailJob.js'

/**
 * All mailing-related jobs that get registered with Payload
 */
export const mailingJobs = [
  processEmailJob,
]

// Re-export everything from individual job files
export * from './processEmailJob.js'
