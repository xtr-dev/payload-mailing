import { processEmailsJob, ProcessEmailsJobData } from './processEmailsJob.js'
import { sendEmailJob } from './sendEmailTask.js'
import { MailingService } from '../services/MailingService.js'

export const mailingJobs = [
  {
    slug: 'processEmails',
    handler: async ({ job, req }: { job: any; req: any }) => {
      // Get mailing context from payload
      const payload = (req as any).payload
      const mailingContext = payload.mailing
      if (!mailingContext) {
        throw new Error('Mailing plugin not properly initialized')
      }

      // Use the existing mailing service from context
      await processEmailsJob(
        job as { data: ProcessEmailsJobData },
        { req, mailingService: mailingContext.service }
      )

      return {
        output: {
          success: true,
          message: 'Email queue processing completed successfully'
        }
      }
    },
    interfaceName: 'ProcessEmailsJob',
  },
  sendEmailJob,
]

export * from './processEmailsJob.js'
export * from './sendEmailTask.js'