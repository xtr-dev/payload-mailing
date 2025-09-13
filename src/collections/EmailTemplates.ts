import type { CollectionConfig, RichTextField } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const createEmailTemplatesCollection = (editor?: RichTextField['editor']): CollectionConfig => ({
  slug: 'email-templates',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'subject', 'updatedAt'],
    group: 'Mailing',
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
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
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'Email subject line. You can use Handlebars variables like {{firstName}} or {{siteName}}.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      editor: editor || lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
        ],
      }),
      admin: {
        description: 'Email content with rich text formatting. Supports Handlebars variables like {{firstName}} and helpers like {{formatDate createdAt "long"}}. Content is converted to HTML and plain text automatically.',
      },
    },
  ],
  timestamps: true,
})

// Default export for backward compatibility
const EmailTemplates = createEmailTemplatesCollection()
export default EmailTemplates
