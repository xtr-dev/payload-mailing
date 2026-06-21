import type { CollectionConfig } from 'payload'

import { resolveID } from '../utils/helpers.js'
import { ensureEmailJob } from '../utils/jobScheduler.js'
import { createContextLogger } from '../utils/logger.js'

const Emails: CollectionConfig = {
  slug: 'emails',
  admin: {
    defaultColumns: ['subject', 'to', 'status', 'jobs', 'scheduledAt', 'sentAt'],
    description: 'Email delivery and status tracking',
    group: 'Mailing',
    useAsTitle: 'subject',
  },
  defaultPopulate: {
    attempts: true,
    bcc: true,
    cc: true,
    createdAt: true,
    error: true,
    from: true,
    html: true,
    jobs: true,
    lastAttemptAt: true,
    priority: true,
    replyTo: true,
    scheduledAt: true,
    sentAt: true,
    status: true,
    templateSlug: true,
    text: true,
    to: true,
    variables: true,
  },
  fields: [
    {
      name: 'template',
      type: 'relationship',
      admin: {
        description: 'Email template used (optional if custom content provided)',
      },
      relationTo: 'email-templates' as const,
    },
    {
      name: 'templateSlug',
      type: 'text',
      admin: {
        description: 'Slug of the email template (auto-populated from template relationship)',
        readOnly: true,
      },
    },
    {
      name: 'to',
      type: 'text',
      admin: {
        description: 'Recipient email addresses',
      },
      hasMany: true,
      required: true,
    },
    {
      name: 'cc',
      type: 'text',
      admin: {
        description: 'CC email addresses',
      },
      hasMany: true,
    },
    {
      name: 'bcc',
      type: 'text',
      admin: {
        description: 'BCC email addresses',
      },
      hasMany: true,
    },
    {
      name: 'from',
      type: 'text',
      admin: {
        description: 'Sender email address (optional, uses default if not provided)',
      },
    },
    {
      name: 'fromName',
      type: 'text',
      admin: {
        description: 'Sender display name (optional, e.g., "John Doe" for "John Doe <john@example.com>")',
      },
    },
    {
      name: 'replyTo',
      type: 'text',
      admin: {
        description: 'Reply-to email address',
      },
    },
    {
      name: 'subject',
      type: 'text',
      admin: {
        description: 'Email subject line',
      },
      required: true,
    },
    {
      name: 'html',
      type: 'textarea',
      admin: {
        description: 'Rendered HTML content of the email',
        rows: 8,
      },
      required: true,
    },
    {
      name: 'text',
      type: 'textarea',
      admin: {
        description: 'Plain text version of the email',
        rows: 6,
      },
    },
    {
      name: 'variables',
      type: 'json',
      admin: {
        description: 'Template variables used to render this email',
      },
    },
    {
      name: 'scheduledAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this email should be sent (leave empty for immediate)',
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this email was actually sent',
      },
    },
    {
      name: 'status',
      type: 'select',
      admin: {
        description: 'Current status of this email',
      },
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      required: true,
    },
    {
      name: 'attempts',
      type: 'number',
      admin: {
        description: 'Number of send attempts made',
      },
      defaultValue: 0,
    },
    {
      name: 'lastAttemptAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the last send attempt was made',
      },
    },
    {
      name: 'error',
      type: 'textarea',
      admin: {
        description: 'Last error message if send failed',
        rows: 3,
      },
    },
    {
      name: 'priority',
      type: 'number',
      admin: {
        description: 'Email priority (1=highest, 10=lowest)',
      },
      defaultValue: 5,
    },
    {
      name: 'jobs',
      type: 'relationship',
      admin: {
        allowCreate: false,
        description: 'Processing jobs associated with this email',
        readOnly: true,
      },
      filterOptions: ({ id }) => {
        const emailId = resolveID(id)
        return {
          'input.emailId': {
            equals: emailId ? String(emailId) : '',
          },
        }
      },
      hasMany: true,
      relationTo: 'payload-jobs',
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Auto-populate templateSlug from template relationship
        if (data.template) {
          try {
            const template = await req.payload.findByID({
              id: typeof data.template === 'string' ? data.template : data.template.id,
              collection: 'email-templates',
            })
            data.templateSlug = template.slug
          } catch (error) {
            // If template lookup fails, clear the slug
            data.templateSlug = undefined
          }
        } else {
          // Clear templateSlug if template is removed
          data.templateSlug = undefined
        }
        return data
      }
    ],
    // Simple approach: Only use afterChange hook for job management
    // This avoids complex interaction between hooks and ensures document ID is always available
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        // Skip if:
        // 1. Email is not pending status
        // 2. Jobs are not configured
        // 3. Email already has jobs (unless status just changed to pending)

        const shouldSkip =
          doc.status !== 'pending' ||
          !req.payload.jobs ||
          (doc.jobs?.length > 0 && previousDoc?.status === 'pending')

        if (shouldSkip) {
          return
        }

        try {
          // Ensure a job exists for this email
          // This function handles:
          // - Checking for existing jobs (duplicate prevention)
          // - Creating new job if needed
          // - Returning all job IDs
          //
          // Note: We don't call updateEmailJobRelationship here because:
          // 1. The jobs field has filterOptions that dynamically queries jobs by emailId
          // 2. Updating the relationship in afterChange causes transaction isolation issues
          //    (the new job isn't committed yet, so the relationship validation fails)
          await ensureEmailJob(req.payload, doc.id, {
            scheduledAt: doc.scheduledAt,
          })
        } catch (error) {
          // Log error but don't throw - we don't want to fail the email operation
          const logger = createContextLogger(req.payload, 'EMAILS_HOOK')
          logger.error(`Failed to ensure job for email ${doc.id}:`, error)
        }
      }
    ]
  },
  indexes: [
    {
      fields: ['status', 'scheduledAt'],
    },
    {
      fields: ['priority', 'createdAt'],
    },
  ],
  timestamps: true,
}

export default Emails
