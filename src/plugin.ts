import type {CollectionConfig, Config, Field} from 'payload'
import { MailingPluginConfig, MailingContext } from './types/index.js'
import { MailingService } from './services/MailingService.js'
import { createEmailTemplatesCollection } from './collections/EmailTemplates.js'
import Emails from './collections/Emails.js'

// Helper function to schedule the email processing job
async function scheduleEmailProcessingJob(payload: any, queueName: string): Promise<void> {
  const jobSlug = 'process-email-queue'

  // Check if there's already a scheduled job for this task
  const existingJobs = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        {
          taskSlug: {
            equals: jobSlug,
          },
        },
        {
          hasCompleted: {
            equals: false,
          },
        },
      ],
    },
    limit: 1,
  })

  // If no existing job, schedule a new one
  if (existingJobs.docs.length === 0) {
    await payload.create({
      collection: 'payload-jobs',
      data: {
        taskSlug: jobSlug,
        input: {},
        queue: queueName,
        waitUntil: new Date(Date.now() + 60000), // Start in 1 minute
      },
    })
    console.log(`🔄 Scheduled email processing job in queue: ${queueName}`)
  } else {
    console.log(`✅ Email processing job already scheduled in queue: ${queueName}`)
  }
}

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
        {
          slug: 'process-email-queue',
          handler: async ({ job, req }: { job: any; req: any }) => {
            const payload = (req as any).payload
            let jobResult = null

            try {
              const mailingService = new MailingService(payload, pluginConfig)

              console.log('🔄 Processing email queue (pending + failed emails)...')

              // Process pending emails first
              await mailingService.processEmails()

              // Then retry failed emails
              await mailingService.retryFailedEmails()

              jobResult = {
                output: {
                  success: true,
                  message: 'Email queue processed successfully (pending and failed emails)'
                }
              }

              console.log('✅ Email queue processing completed successfully')

            } catch (error) {
              console.error('❌ Error processing email queue:', error)
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'

              jobResult = new Error(`Email queue processing failed: ${errorMessage}`)
            }

            // Always reschedule the next job (success or failure)
            try {
              await payload.create({
                collection: 'payload-jobs',
                data: {
                  taskSlug: 'process-email-queue',
                  input: {},
                  queue: queueName,
                  waitUntil: new Date(Date.now() + 300000), // Reschedule in 5 minutes
                },
              })
              console.log(`🔄 Rescheduled next email processing job in ${queueName} queue`)
            } catch (rescheduleError) {
              console.error('❌ Failed to reschedule email processing job:', rescheduleError)
            }

            // Return the original result or throw the error
            if (jobResult instanceof Error) {
              throw jobResult
            }
            return jobResult
          },
          interfaceName: 'ProcessEmailQueueJob',
        },
      ],
    },
    onInit: async (payload: any) => {
      if (pluginConfig.initOrder === 'after' && config.onInit) {
        await config.onInit(payload)
      }

      // Initialize mailing service
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

      console.log('PayloadCMS Mailing Plugin initialized successfully')

      // Schedule the email processing job if not already scheduled
      try {
        await scheduleEmailProcessingJob(payload, queueName)
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
