import { Job } from 'payload/jobs'
import { processOutboxJob, ProcessOutboxJobData } from './processOutboxJob'
import { MailingService } from '../services/MailingService'

export const createMailingJobs = (mailingService: MailingService): Job[] => {
  return [
    {
      slug: 'processOutbox',
      handler: async ({ job, req }) => {
        return processOutboxJob(
          job as { data: ProcessOutboxJobData },
          { req, mailingService }
        )
      },
      interfaceName: 'ProcessOutboxJob',
    },
  ]
}

export * from './processOutboxJob'