import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalHTML,
} from '@payloadcms/richtext-lexical'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed, seedUser } from './seed.js'
import mailingPlugin from "../src/plugin.js"
import { sendEmail } from "../src/utils/helpers.js"

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
                    templateSlug: 'welcome-email',
                    to: doc.email,
                    variables: {
                      firstName: doc.firstName || doc.email?.split('@')?.[0],
                      siteName: 'PayloadCMS Mailing Demo',
                      createdAt: new Date().toISOString(),
                      isPremium: false,
                      dashboardUrl: 'http://localhost:3000/admin',
                    },
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
        transport: {
          host: 'localhost',
          port: 1025, // MailHog port for dev
          secure: false,
          auth: {
            user: 'test',
            pass: 'test',
          },
        },
        retryAttempts: 3,
        retryDelay: 60000, // 1 minute for dev
        queue: 'email-queue',

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

        emailWrapper: (email) => {
          // Example: wrap email content in a custom layout
          const wrappedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>${email.subject}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; }
                .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>My Company</h1>
                </div>
                <div class="content">
                  ${email.html}
                </div>
                <div class="footer">
                  This email was sent from My Company. If you have questions, contact support@mycompany.com
                </div>
              </div>
            </body>
            </html>
          `

          const wrappedText = `
MY COMPANY
==========

${email.text || email.html?.replace(/<[^>]*>/g, '')}

---
This email was sent from My Company.
If you have questions, contact support@mycompany.com
          `

          return {
            ...email,
            html: wrappedHtml,
            text: wrappedText.trim(),
          }
        },

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
