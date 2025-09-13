import type { PayloadRequest } from 'payload'
import { MailingService } from '../services/MailingService.js'

export interface ProcessEmailsJobData {
  type: 'process-emails' | 'retry-failed'
}

export const processEmailsJob = async (
  job: { data: ProcessEmailsJobData },
  context: { req: PayloadRequest; mailingService: MailingService }
) => {
  const { mailingService } = context
  const { type } = job.data

  try {
    if (type === 'process-emails') {
      await mailingService.processEmails()
      console.log('Email processing completed successfully')
    } else if (type === 'retry-failed') {
      await mailingService.retryFailedEmails()
      console.log('Failed email retry completed successfully')
    }
  } catch (error) {
    console.error(`${type} job failed:`, error)
    throw error
  }
}

export const scheduleEmailsJob = async (
  payload: any,
  queueName: string,
  jobType: 'process-emails' | 'retry-failed',
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
      input: { type: jobType },
      waitUntil: delay ? new Date(Date.now() + delay) : undefined,
    })
  } catch (error) {
    console.error(`Failed to schedule ${jobType} job:`, error)
  }
}