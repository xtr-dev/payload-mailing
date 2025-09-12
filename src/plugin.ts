import { Config } from 'payload/config'
import { MailingPluginConfig, MailingContext } from './types'
import { MailingService } from './services/MailingService'
import { createMailingJobs } from './jobs'
import EmailTemplates from './collections/EmailTemplates'
import EmailOutbox from './collections/EmailOutbox'
import { scheduleOutboxJob } from './jobs/processOutboxJob'

export const mailingPlugin = (pluginConfig: MailingPluginConfig) => (config: Config): Config => {
  const templatesSlug = pluginConfig.collections?.templates || 'email-templates'
  const outboxSlug = pluginConfig.collections?.outbox || 'email-outbox'
  const queueName = pluginConfig.queue || 'default'

  // Update collection slugs if custom ones are provided
  const templatesCollection = {
    ...EmailTemplates,
    slug: templatesSlug,
  }

  const outboxCollection = {
    ...EmailOutbox,
    slug: outboxSlug,
    fields: EmailOutbox.fields.map(field => {
      if (field.name === 'template' && field.type === 'relationship') {
        return {
          ...field,
          relationTo: templatesSlug,
        }
      }
      return field
    }),
  }

  return {
    ...config,
    collections: [
      ...(config.collections || []),
      templatesCollection,
      outboxCollection,
    ],
    jobs: {
      ...(config.jobs || {}),
      tasks: [
        ...(config.jobs?.tasks || []),
        // Jobs will be added via onInit hook
      ],
    },
    onInit: async (payload) => {
      // Call original onInit if it exists
      if (config.onInit) {
        await config.onInit(payload)
      }

      // Initialize mailing service
      const mailingService = new MailingService(payload, pluginConfig)
      
      // Add mailing jobs
      const mailingJobs = createMailingJobs(mailingService)
      if (payload.jobs) {
        mailingJobs.forEach(job => {
          payload.jobs.addTask(job)
        })
      }

      // Schedule periodic outbox processing (every 5 minutes)
      const schedulePeriodicJob = async () => {
        await scheduleOutboxJob(payload, queueName, 'process-outbox', 5 * 60 * 1000) // 5 minutes
        setTimeout(schedulePeriodicJob, 5 * 60 * 1000) // Schedule next run
      }

      // Schedule periodic retry job (every 30 minutes)
      const scheduleRetryJob = async () => {
        await scheduleOutboxJob(payload, queueName, 'retry-failed', 30 * 60 * 1000) // 30 minutes
        setTimeout(scheduleRetryJob, 30 * 60 * 1000) // Schedule next run
      }

      // Start periodic jobs if jobs are enabled
      if (payload.jobs) {
        setTimeout(schedulePeriodicJob, 5 * 60 * 1000) // Start after 5 minutes
        setTimeout(scheduleRetryJob, 15 * 60 * 1000) // Start after 15 minutes
      }

      // Add mailing context to payload for developer access
      ;(payload as any).mailing = {
        service: mailingService,
        config: pluginConfig,
        collections: {
          templates: templatesSlug,
          outbox: outboxSlug,
        },
      } as MailingContext

      console.log('PayloadCMS Mailing Plugin initialized successfully')
    },
  }
}

export default mailingPlugin