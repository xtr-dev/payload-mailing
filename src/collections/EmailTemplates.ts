import type { CollectionConfig, RichTextField } from 'payload'

import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const createEmailTemplatesCollection = (editor?: RichTextField['editor']): CollectionConfig => ({
  slug: 'email-templates',
  admin: {
    defaultColumns: ['name', 'subject', 'updatedAt'],
    group: 'Mailing',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      admin: {
        description: 'A descriptive name for this email template',
      },
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'Unique identifier for this template (e.g., "welcome-email", "password-reset")',
      },
      hooks: {
        beforeChange: [
          ({ value }) => {
            if (value) {
              return value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
            }
            return value
          },
        ],
      },
      required: true,
      unique: true,
    },
    {
      name: 'subject',
      type: 'text',
      admin: {
        description: 'Email subject line. You can use Handlebars variables like {{firstName}} or {{siteName}}.',
      },
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description: 'Email content with rich text formatting. Supports Handlebars variables like {{firstName}} and helpers like {{formatDate createdAt "long"}}. Content is converted to HTML and plain text automatically.',
      },
      editor: editor || lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
        ],
      }),
      required: true,
    },
  ],
  timestamps: true,
})

// Default export for backward compatibility
const EmailTemplates = createEmailTemplatesCollection()
export default EmailTemplates
