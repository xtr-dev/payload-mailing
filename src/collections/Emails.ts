import type { CollectionConfig } from 'payload'

const Emails: CollectionConfig = {
  slug: 'emails',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'to', 'status', 'scheduledAt', 'sentAt'],
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
  ],
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
