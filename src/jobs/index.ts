import { processEmailsJob, ProcessEmailsJobData } from './processEmailsJob.js'
import { sendEmailJob } from './sendEmailTask.js'
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
    sendEmailJob,
  ]
}

export * from './processEmailsJob.js'
export * from './sendEmailTask.js'