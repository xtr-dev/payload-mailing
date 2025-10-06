import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
} from '@payloadcms/richtext-lexical'
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

export default buildConfig({
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
    db: sqliteAdapter({
      client: {
        url: process.env.DATABASE_URI || 'file:./dev.db',
      },
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    jobs: {
      jobsCollectionOverrides: c => {
        if (c.defaultJobsCollection.admin) c.defaultJobsCollection.admin.hidden = false
        return c.defaultJobsCollection
      },
      autoRun: [
        {
          cron: '*/1 * * * *', // every minute
          limit: 10, // limit jobs to process each run
          queue: 'default', // name of the queue
        },
      ],
    },
    plugins: [
      mailingPlugin({
        defaultFrom: 'noreply@test.com',
        initOrder: 'after',
        retryAttempts: 3,
        retryDelay: 60000, // 1 minute for dev
        queue: 'default',

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
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
