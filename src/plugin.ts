import type {CollectionConfig, Config, Field} from 'payload'
import { MailingPluginConfig, MailingContext } from './types/index.js'
import { MailingService } from './services/MailingService.js'
import { createEmailTemplatesCollection } from './collections/EmailTemplates.js'
import Emails from './collections/Emails.js'
import { mailingJobs } from './jobs/index.js'


export const mailingPlugin = (pluginConfig: MailingPluginConfig) => (config: Config): Config => {
  const queueName = pluginConfig.queue || 'default'

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

  // Filter out any existing collections with the same slugs to prevent duplicates
  const existingCollections = (config.collections || []).filter(
    (collection) => collection.slug !== templatesSlug && collection.slug !== emailsSlug
  )

  return {
    ...config,
    collections: [
      ...existingCollections,
      templatesCollection,
      emailsCollection,
    ],
    jobs: {
      ...(config.jobs || {}),
      tasks: [
        ...(config.jobs?.tasks || []),
        ...mailingJobs,
      ],
    },
    onInit: async (payload: any) => {
      if (pluginConfig.initOrder === 'after' && config.onInit) {
        await config.onInit(payload)
      }

      // Initialize mailing service with proper payload instance
      const mailingService = new MailingService(payload, pluginConfig)

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



      if (pluginConfig.initOrder !== 'after' && config.onInit) {
        await config.onInit(payload)
      }
    },
  }
}

export default mailingPlugin
