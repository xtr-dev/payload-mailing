import type {CollectionConfig, Config, Field} from 'payload'
import { MailingPluginConfig, MailingContext } from './types/index.js'
import { MailingService } from './services/MailingService.js'
import { createEmailTemplatesCollection } from './collections/EmailTemplates.js'
import Emails from './collections/Emails.js'
import { createMailingJobs, scheduleEmailsJob } from './jobs/index.js'


export const mailingPlugin = (pluginConfig: MailingPluginConfig) => (config: Config): Config => {
  const queueName = pluginConfig.queue || 'default'

  // Validate queueName
  if (!queueName || typeof queueName !== 'string') {
    throw new Error('Invalid queue configuration: queue must be a non-empty string')
  }

  // Create a factory function that will provide the mailing service once initialized
  const getMailingService = () => {
    if (!mailingService) {
      throw new Error('MailingService not yet initialized - this should only be called after plugin initialization')
    }
    return mailingService
  }
  let mailingService: MailingService

  // Handle templates collection configuration
  const templatesConfig = pluginConfig.collections?.templates
  const templatesSlug = typeof templatesConfig === 'string' ? templatesConfig : 'email-templates'
  const templatesOverrides = typeof templatesConfig === 'object' ? templatesConfig : {}

  // Create base templates collection with custom editor if provided
  const baseTemplatesCollection = createEmailTemplatesCollection(pluginConfig.richTextEditor)

  const templatesCollection = {
    ...baseTemplatesCollection,
    slug: templatesSlug,
    ...templatesOverrides,
    // Ensure admin config is properly merged
    admin: {
      ...baseTemplatesCollection.admin,
      ...templatesOverrides.admin,
    },
    // Ensure access config is properly merged
    access: {
      ...baseTemplatesCollection.access,
      ...templatesOverrides.access,
    },
  } satisfies CollectionConfig

  // Handle emails collection configuration
  const emailsConfig = pluginConfig.collections?.emails
  const emailsSlug = typeof emailsConfig === 'string' ? emailsConfig : 'emails'
  const emailsOverrides = typeof emailsConfig === 'object' ? emailsConfig : {}

  const emailsCollection = {
    ...Emails,
    slug: emailsSlug,
    ...emailsOverrides,
    // Ensure admin config is properly merged
    admin: {
      ...Emails.admin,
      ...emailsOverrides.admin,
    },
    // Ensure access config is properly merged
    access: {
      ...Emails.access,
      ...emailsOverrides.access,
    },
    // Update relationship fields to point to correct templates collection
    fields: (emailsOverrides.fields || Emails.fields).map((field: Field) => {
      if (field &&
          typeof field === 'object' &&
          'name' in field &&
          field.name === 'template' &&
          field.type === 'relationship') {
        return {
          ...field,
          relationTo: templatesSlug,
        } as typeof field
      }
      return field
    }),
  } satisfies CollectionConfig

  return {
    ...config,
    collections: [
      ...(config.collections || []),
      templatesCollection,
      emailsCollection,
    ],
    jobs: {
      ...(config.jobs || {}),
      tasks: [
        ...(config.jobs?.tasks || []),
        // Jobs will be properly added after initialization
      ],
    },
    onInit: async (payload: any) => {
      if (pluginConfig.initOrder === 'after' && config.onInit) {
        await config.onInit(payload)
      }

      // Initialize mailing service with proper payload instance
      mailingService = new MailingService(payload, pluginConfig)

      // Add mailing jobs to payload's job system
      const mailingJobs = createMailingJobs(mailingService)
      mailingJobs.forEach(job => {
        payload.jobs.tasks.push(job)
      })

      // Add mailing context to payload for developer access
      ;(payload as any).mailing = {
        payload,
        service: mailingService,
        config: pluginConfig,
        collections: {
          templates: templatesSlug,
          emails: emailsSlug,
        },
      } as MailingContext

      console.log('PayloadCMS Mailing Plugin initialized successfully')

      // Schedule the initial email processing job
      try {
        await scheduleEmailsJob(payload, queueName, 60000) // Schedule in 1 minute
        console.log(`🔄 Scheduled initial email processing job in queue: ${queueName}`)
      } catch (error) {
        console.error('Failed to schedule email processing job:', error)
      }

      // Call onReady callback if provided
      if (pluginConfig.onReady) {
        await pluginConfig.onReady(payload)
      }

      if (pluginConfig.initOrder !== 'after' && config.onInit) {
        await config.onInit(payload)
      }
    },
  }
}

export default mailingPlugin
