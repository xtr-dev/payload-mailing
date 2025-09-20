import type { PayloadRequest, Payload } from 'payload'
import { processAllEmails } from '../utils/emailProcessor.js'
import { createContextLogger } from '../utils/logger.js'

/**
 * Data passed to the process emails task
 */
export interface ProcessEmailsTaskData {
  // Currently no data needed - always processes both pending and failed emails
}

/**
 * Handler function for processing emails
 * Used internally by the task definition
 */
export const processEmailsTaskHandler = async (
  job: { data: ProcessEmailsTaskData },
  context: { req: PayloadRequest }
) => {
  const { req } = context
  const payload = (req as any).payload

  // Use the shared email processing logic
  await processAllEmails(payload)
}

/**
 * Task definition for processing emails
 * This is what gets registered with Payload's job system
 */
export const processEmailsTask = {
  slug: 'process-emails',
  handler: async ({ job, req }: { job: any; req: any }) => {
    // Get mailing context from payload
    const payload = (req as any).payload
    const mailingContext = payload.mailing

    if (!mailingContext) {
      throw new Error('Mailing plugin not properly initialized')
    }

    // Use the task handler
    await processEmailsTaskHandler(
      job as { data: ProcessEmailsTaskData },
      { req }
    )

    return {
      output: {
        success: true,
        message: 'Email queue processing completed successfully'
      }
    }
  },
  interfaceName: 'ProcessEmailsTask',
}

// For backward compatibility, export as processEmailsJob
export const processEmailsJob = processEmailsTask

/**
 * Helper function to schedule an email processing job
 * Used by the plugin during initialization and can be used by developers
 */
export const scheduleEmailsJob = async (
  payload: Payload,
  queueName: string,
  delay?: number
) => {
  if (!payload.jobs) {
    const logger = createContextLogger(payload, 'SCHEDULER')
    logger.warn('PayloadCMS jobs not configured - emails will not be processed automatically')
    return
  }

  try {
    await payload.jobs.queue({
      queue: queueName,
      task: 'process-emails',
      input: {},
      waitUntil: delay ? new Date(Date.now() + delay) : undefined,
    } as any)
  } catch (error) {
    const logger = createContextLogger(payload, 'SCHEDULER')
    logger.error('Failed to schedule email processing job:', error)
  }
}
