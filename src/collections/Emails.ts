import type { CollectionConfig } from 'payload'

const Emails: CollectionConfig = {
  slug: 'emails',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'to', 'status', 'jobs', 'scheduledAt', 'sentAt'],
    group: 'Mailing',
    description: 'Email delivery and status tracking',
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
        return {
          'input.emailId': {
            equals: id,
          },
        }
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        // Only process if this is a pending email and we have jobs configured
        if (data.status !== 'pending' || !req.payload.jobs) {
          return data
        }

        // For updates, check if status changed to pending or if this was already pending
        if (operation === 'update') {
          // If it was already pending and still pending, skip (unless jobs field is empty)
          if (originalDoc?.status === 'pending' && data.jobs && data.jobs.length > 0) {
            return data
          }

          // For updates where we need to check existing jobs, we need the document ID
          if (originalDoc?.id) {
            try {
              // Check if a processing job already exists for this email
              const existingJobs = await req.payload.find({
                collection: 'payload-jobs',
                where: {
                  'input.emailId': {
                    equals: String(originalDoc.id),
                  },
                  task: {
                    equals: 'process-email',
                  },
                },
                limit: 10,
              })

              if (existingJobs.totalDocs > 0) {
                // Add existing jobs to the relationship
                const existingJobIds = existingJobs.docs.map(job => job.id)
                data.jobs = [...(data.jobs || []), ...existingJobIds.filter(id => !data.jobs?.includes(id))]
                return data
              }
            } catch (error) {
              console.error(`Failed to check existing jobs for email ${originalDoc.id}:`, error)
            }
          }
        }

        // For new emails or updates that need a new job, we'll create it after the document exists
        // We'll handle this in afterChange for new documents since we need the ID
        return data
      }
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // Only process if this is a pending email, we have jobs configured, and no job exists yet
        if (doc.status !== 'pending' || !req.payload.jobs) {
          return
        }

        // Skip if this is an update and status didn't change to pending, and jobs already exist
        if (operation === 'update' && previousDoc?.status === 'pending' && doc.jobs && doc.jobs.length > 0) {
          return
        }

        try {
          // Check if a processing job already exists for this email
          const existingJobs = await req.payload.find({
            collection: 'payload-jobs',
            where: {
              'input.emailId': {
                equals: String(doc.id),
              },
              task: {
                equals: 'process-email',
              },
            },
            limit: 1,
          })

          // If no job exists, create one and add it to the relationship
          if (existingJobs.totalDocs === 0) {
            const mailingContext = (req.payload as any).mailing
            const queueName = mailingContext?.config?.queue || 'default'

            const job = await req.payload.jobs.queue({
              queue: queueName,
              task: 'process-email',
              input: {
                emailId: String(doc.id)
              },
              // If scheduled, set the waitUntil date
              waitUntil: doc.scheduledAt ? new Date(doc.scheduledAt) : undefined
            })

            // Update the email document to include the job in the relationship
            await req.payload.update({
              collection: 'emails',
              id: doc.id,
              data: {
                jobs: [...(doc.jobs || []), job.id]
              }
            })

            console.log(`Auto-scheduled processing job ${job.id} for email ${doc.id}`)
          }
        } catch (error) {
          console.error(`Failed to auto-schedule job for email ${doc.id}:`, error)
          // Don't throw - we don't want to fail the email creation/update
        }
      }
    ]
  },
  timestamps: true,
  // indexes: [
  //   {
  //     fields: {
  //       status: 1,
  //       scheduledAt: 1,
  //     },
  //   },
  //   {
  //     fields: {
  //       priority: -1,
  //       createdAt: 1,
  //     },
  //   },
  // ],
}

export default Emails
