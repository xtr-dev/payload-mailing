import type { CollectionConfig } from 'payload'
import { findExistingJobs, ensureEmailJob, updateEmailJobRelationship } from '../utils/jobScheduler.js'
import { createContextLogger } from '../utils/logger.js'
import { resolveID } from '../utils/helpers.js'

const Emails: CollectionConfig = {
  slug: 'emails',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'to', 'status', 'jobs', 'scheduledAt', 'sentAt'],
    group: 'Mailing',
    description: 'Email delivery and status tracking',
  },
  defaultPopulate: {
    template: true,
    to: true,
    cc: true,
    bcc: true,
    from: true,
    replyTo: true,
    jobs: true,
    status: true,
    attempts: true,
    lastAttemptAt: true,
    error: true,
    priority: true,
    scheduledAt: true,
    sentAt: true,
    variables: true,
    html: true,
    text: true,
    createdAt: true,
  },
  fields: [
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'email-templates' as const,
      admin: {
        description: 'Email template used (optional if custom content provided)',
      },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      hasMany: true,
      admin: {
        description: 'Recipient email addresses',
      },
    },
    {
      name: 'cc',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'CC email addresses',
      },
    },
    {
      name: 'bcc',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'BCC email addresses',
      },
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
      required: true,
      admin: {
        description: 'Email subject line',
      },
    },
    {
      name: 'html',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Rendered HTML content of the email',
        rows: 8,
      },
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
        description: 'When this email should be sent (leave empty for immediate)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      admin: {
        description: 'When this email was actually sent',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'pending',
      admin: {
        description: 'Current status of this email',
      },
    },
    {
      name: 'attempts',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of send attempts made',
      },
    },
    {
      name: 'lastAttemptAt',
      type: 'date',
      admin: {
        description: 'When the last send attempt was made',
        date: {
          pickerAppearance: 'dayAndTime',
        },
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
      defaultValue: 5,
      admin: {
        description: 'Email priority (1=highest, 10=lowest)',
      },
    },
    {
      name: 'jobs',
      type: 'relationship',
      relationTo: 'payload-jobs',
      hasMany: true,
      admin: {
        description: 'Processing jobs associated with this email',
        allowCreate: false,
        readOnly: true,
      },
      filterOptions: ({ id }) => {
        const emailId = resolveID({ id })
        return {
          'input.emailId': {
            equals: emailId ? String(emailId) : '',
          },
        }
      },
    },
  ],
  hooks: {
    // Simple approach: Only use afterChange hook for job management
    // This avoids complex interaction between hooks and ensures document ID is always available
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
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
          const result = await ensureEmailJob(req.payload, doc.id, {
            scheduledAt: doc.scheduledAt,
          })

          // Update the email's job relationship if we have jobs
          // This handles both new jobs and existing jobs that weren't in the relationship
          if (result.jobIds.length > 0) {
            await updateEmailJobRelationship(req.payload, doc.id, result.jobIds, 'emails')
          }
        } catch (error) {
          // Log error but don't throw - we don't want to fail the email operation
          const logger = createContextLogger(req.payload, 'EMAILS_HOOK')
          logger.error(`Failed to ensure job for email ${doc.id}:`, error)
        }
      }
    ]
  },
  timestamps: true,
  indexes: [
    {
      fields: ['status', 'scheduledAt'],
    },
    {
      fields: ['priority', 'createdAt'],
    },
  ],
}

export default Emails
