import { CollectionConfig } from 'payload/types'

const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'subject', 'updatedAt'],
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
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'A descriptive name for this email template',
      },
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'Email subject line (supports Handlebars variables)',
      },
    },
    {
      name: 'htmlTemplate',
      type: 'textarea',
      required: true,
      admin: {
        description: 'HTML email template (supports Handlebars syntax)',
        rows: 10,
      },
    },
    {
      name: 'textTemplate',
      type: 'textarea',
      admin: {
        description: 'Plain text email template (supports Handlebars syntax)',
        rows: 8,
      },
    },
    {
      name: 'variables',
      type: 'array',
      admin: {
        description: 'Define variables that can be used in this template',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Variable name (e.g., "firstName", "orderTotal")',
          },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Number', value: 'number' },
            { label: 'Boolean', value: 'boolean' },
            { label: 'Date', value: 'date' },
          ],
          defaultValue: 'text',
        },
        {
          name: 'required',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Is this variable required when sending emails?',
          },
        },
        {
          name: 'description',
          type: 'text',
          admin: {
            description: 'Optional description of what this variable represents',
          },
        },
      ],
    },
    {
      name: 'previewData',
      type: 'json',
      admin: {
        description: 'Sample data for previewing this template (JSON format)',
      },
    },
  ],
  timestamps: true,
}

export default EmailTemplates