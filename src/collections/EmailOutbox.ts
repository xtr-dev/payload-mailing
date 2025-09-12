import { CollectionConfig } from 'payload/types'

const EmailOutbox: CollectionConfig = {
  slug: 'email-outbox',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'to', 'status', 'scheduledAt', 'sentAt'],
    group: 'Mailing',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'email-templates',
      admin: {
        description: 'Email template used (optional if custom content provided)',
      },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: {
        description: 'Recipient email address(es), comma-separated',
      },
    },
    {
      name: 'cc',
      type: 'text',
      admin: {
        description: 'CC email address(es), comma-separated',
      },
    },
    {
      name: 'bcc',
      type: 'text',
      admin: {
        description: 'BCC email address(es), comma-separated',
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
  indexes: [
    {
      fields: {
        status: 1,
        scheduledAt: 1,
      },
    },
    {
      fields: {
        priority: -1,
        createdAt: 1,
      },
    },
  ],
}

export default EmailOutbox