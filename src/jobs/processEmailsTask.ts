import type { PayloadRequest, Payload } from 'payload'
import type { MailingService } from '../services/MailingService.js'

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
  context: { req: PayloadRequest; mailingService: MailingService }
) => {
  const { mailingService } = context

  try {
    console.log('🔄 Processing email queue (pending + failed emails)...')

    // Process pending emails first
    await mailingService.processEmails()

    // Then retry failed emails
    await mailingService.retryFailedEmails()

    console.log('✅ Email queue processing completed successfully')
  } catch (error) {
    console.error('❌ Email queue processing failed:', error)
    throw error
  }
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

    // Use the existing mailing service from context
    await processEmailsTaskHandler(
      job as { data: ProcessEmailsTaskData },
      { req, mailingService: mailingContext.service }
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
    console.warn('PayloadCMS jobs not configured - emails will not be processed automatically')
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
    console.error('Failed to schedule email processing job:', error)
  }
}