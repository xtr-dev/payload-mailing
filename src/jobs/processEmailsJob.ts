import type { PayloadRequest } from 'payload'
import { MailingService } from '../services/MailingService.js'

export interface ProcessEmailsJobData {
  // No type needed - always processes both pending and failed emails
}

export const processEmailsJob = async (
  job: { data: ProcessEmailsJobData },
  context: { req: PayloadRequest; mailingService: MailingService }
) => {
  const { mailingService } = context

  try {
    console.log('🔄 Processing email queue (pending + failed emails)...')

    // Process pending emails first
    await mailingService.processEmails()

    // Then retry failed emails
    await mailingService.retryFailedEmails()

    console.log('✅ Email queue processing completed successfully (pending and failed emails)')
  } catch (error) {
    console.error('❌ Email queue processing failed:', error)
    throw error
  }
}

export const scheduleEmailsJob = async (
  payload: any,
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
      task: 'processEmails',
      input: {},
      waitUntil: delay ? new Date(Date.now() + delay) : undefined,
    })
  } catch (error) {
    console.error('Failed to schedule email processing job:', error)
  }
}