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

        // Example designed layout. The rendered template body is injected into
        // the `{{ content }}` slot, giving every email a shared branded header
        // and footer. Layout strings run through the same engine as templates,
        // so `{{ content }}` (and any other variables) are substituted here too.
        // `defaultLayout` applies it to templates that don't pick their own.
        layouts: {
          branded: {
            html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#4f46e5;padding:28px 32px;">
                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">&#10022; Acme Mail</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:15px;line-height:1.6;color:#1f2937;">{{ content }}</td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #eef0f2;font-size:12px;line-height:1.5;color:#6b7280;">
                You're receiving this email from Acme Mail.<br />
                123 Example Street &middot; Amsterdam &middot; NL<br />
                <a href="https://example.com/unsubscribe" style="color:#4f46e5;text-decoration:none;">Unsubscribe</a>
                &middot;
                <a href="https://example.com/preferences" style="color:#4f46e5;text-decoration:none;">Email preferences</a>
              </td>
            </tr>
          </table>
          <div style="font-size:11px;color:#9ca3af;padding:16px 0;">&copy; Acme Mail</div>
        </td>
      </tr>
    </table>
  </body>
</html>`,
            text: `ACME MAIL
=========================================

{{ content }}

-----------------------------------------
You're receiving this email from Acme Mail.
123 Example Street, Amsterdam, NL
Unsubscribe: https://example.com/unsubscribe`,
          },
        },
        defaultLayout: 'branded',

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
