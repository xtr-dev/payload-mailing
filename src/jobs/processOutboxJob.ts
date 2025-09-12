import { PayloadRequest } from 'payload/types'
import { MailingService } from '../services/MailingService'

export interface ProcessOutboxJobData {
  type: 'process-outbox' | 'retry-failed'
}

export const processOutboxJob = async (
  job: { data: ProcessOutboxJobData },
  context: { req: PayloadRequest; mailingService: MailingService }
) => {
  const { mailingService } = context
  const { type } = job.data

  try {
    if (type === 'process-outbox') {
      await mailingService.processOutbox()
      console.log('Outbox processing completed successfully')
    } else if (type === 'retry-failed') {
      await mailingService.retryFailedEmails()
      console.log('Failed email retry completed successfully')
    }
  } catch (error) {
    console.error(`${type} job failed:`, error)
    throw error
  }
}

export const scheduleOutboxJob = async (
  payload: any,
  queueName: string,
  jobType: 'process-outbox' | 'retry-failed',
  delay?: number
) => {
  if (!payload.jobs) {
    console.warn('PayloadCMS jobs not configured - emails will not be processed automatically')
    return
  }

  try {
    await payload.jobs.queue({
      queue: queueName,
      task: 'processOutbox',
      input: { type: jobType },
      waitUntil: delay ? new Date(Date.now() + delay) : undefined,
    })
  } catch (error) {
    console.error(`Failed to schedule ${jobType} job:`, error)
  }
}