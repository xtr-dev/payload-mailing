import { processEmailsJob, ProcessEmailsJobData } from './processEmailsJob.js'
import { MailingService } from '../services/MailingService.js'

export const createMailingJobs = (mailingService: MailingService): any[] => {
  return [
    {
      slug: 'processEmails',
      handler: async ({ job, req }: { job: any; req: any }) => {
        return processEmailsJob(
          job as { data: ProcessEmailsJobData },
          { req, mailingService }
        )
      },
      interfaceName: 'ProcessEmailsJob',
    },
  ]
}

export * from './processEmailsJob.js'