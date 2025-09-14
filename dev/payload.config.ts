import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
} from '@payloadcms/richtext-lexical'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed, seedUser } from './seed.js'
import mailingPlugin from "../src/plugin.js"
import {sendEmail} from "@xtr-dev/payload-mailing"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  // Use in-memory MongoDB for development and testing
  if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URI) {
    console.log('🚀 Starting MongoDB in-memory database...')

    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 1, // Single instance for dev (faster startup)
        dbName: process.env.NODE_ENV === 'test' ? 'payloadmemory' : 'payload-mailing-dev',
        storageEngine: 'wiredTiger',
      },
    })

    const uri = `${memoryDB.getUri()}&retryWrites=true`
    process.env.DATABASE_URI = uri

    console.log('✅ MongoDB in-memory database started')
    console.log(`📊 Database URI: ${uri.replace(/mongodb:\/\/[^@]*@/, 'mongodb://***@')}`)

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Stopping MongoDB in-memory database...')
      await memoryDB.stop()
      process.exit(0)
    })
  } else {
    console.log(`🔗 Using external MongoDB: ${process.env.DATABASE_URI?.replace(/mongodb:\/\/[^@]*@/, 'mongodb://***@')}`)
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [
          {
            name: 'firstName',
            type: 'text',
          },
          {
            name: 'lastName',
            type: 'text',
          },
        ],
        hooks: {
          afterChange: [
            async ({ doc, operation, req, previousDoc }) => {
              // Only send welcome email on user creation, not updates
              if (operation === 'create' && doc.email) {
                try {
                  console.log('📧 Queuing welcome email for new user:', doc.email)

                  // Queue the welcome email using template slug
                  const emailId = await sendEmail(req.payload, {
                    template: {
                      slug: 'welcome-email',
                      variables: {
                        firstName: doc.firstName || doc.email?.split('@')?.[0],
                        siteName: 'PayloadCMS Mailing Demo',
                        createdAt: new Date().toISOString(),
                        isPremium: false,
                        dashboardUrl: 'http://localhost:3000/admin',
                      },
                    },
                    data: {
                      to: doc.email,
                    }
                  })

                  console.log('✅ Welcome email queued successfully. Email ID:', emailId)
                } catch (error) {
                  console.error('❌ Error queuing welcome email:', error)
                  // Don't throw - we don't want to fail user creation if email fails
                }
              }

              return doc
            },
          ],
        },
      },
      {
        slug: 'posts',
        fields: [],
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URI || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      mailingPlugin({
        defaultFrom: 'noreply@test.com',
        initOrder: 'after',
        retryAttempts: 3,
        retryDelay: 60000, // 1 minute for dev
        queue: 'email-queue',

        // Example: Collection overrides for customization
        // Uncomment and modify as needed for your use case
        /*
        collections: {
          templates: {
            // Custom access controls - restrict who can manage templates
            access: {
              read: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:read')
              },
              create: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:create')
              },
              update: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:update')
              },
              delete: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin'
              },
            },
            // Custom admin UI settings
            admin: {
              group: 'Marketing',
              description: 'Email templates with enhanced security and categorization'
            },
            // Add custom fields to templates
            fields: [
              // Default plugin fields are automatically included
              {
                name: 'category',
                type: 'select',
                options: [
                  { label: 'Marketing', value: 'marketing' },
                  { label: 'Transactional', value: 'transactional' },
                  { label: 'System Notifications', value: 'system' }
                ],
                defaultValue: 'transactional',
                admin: {
                  position: 'sidebar',
                  description: 'Template category for organization'
                }
              },
              {
                name: 'tags',
                type: 'text',
                hasMany: true,
                admin: {
                  position: 'sidebar',
                  description: 'Tags for easy template filtering'
                }
              },
              {
                name: 'isActive',
                type: 'checkbox',
                defaultValue: true,
                admin: {
                  position: 'sidebar',
                  description: 'Only active templates can be used'
                }
              }
            ],
            // Custom validation hooks
            hooks: {
              beforeChange: [
                ({ data, req }) => {
                  // Example: Only admins can create system templates
                  if (data.category === 'system' && req.user?.role !== 'admin') {
                    throw new Error('Only administrators can create system notification templates')
                  }

                  // Example: Auto-generate slug if not provided
                  if (!data.slug && data.name) {
                    data.slug = data.name.toLowerCase()
                      .replace(/[^a-z0-9]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '')
                  }

                  return data
                }
              ]
            }
          },
          emails: {
            // Restrict access to emails collection
            access: {
              read: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:read')
              },
              create: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:create')
              },
              update: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin' || user.permissions?.includes('mailing:update')
              },
              delete: ({ req: { user } }) => {
                if (!user) return false
                return user.role === 'admin'
              },
            },
            // Custom admin configuration for emails
            admin: {
              group: 'Marketing',
              description: 'Email delivery tracking and management',
              defaultColumns: ['subject', 'to', 'status', 'priority', 'scheduledAt'],
            }
          }
        },
        */

        // Optional: Custom rich text editor configuration
        // Comment out to use default lexical editor
        richTextEditor: lexicalEditor({
          features: ({ defaultFeatures }) => [
            ...defaultFeatures,
            // Example: Add custom features for email templates
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
            HorizontalRuleFeature(),
            // You can add more features like:
            // BlocksFeature({ blocks: [...] }),
            // LinkFeature({ ... }),
            // etc.
          ],
        }),


        // Called after mailing plugin is fully initialized
        onReady: async (payload) => {
          await seedUser(payload)
        },
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
