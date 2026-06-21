import type { CollectionConfig, Field, RichTextField } from 'payload'

import { lexicalEditor } from '@payloadcms/richtext-lexical'

/**
 * Builds the optional `layout` select field. Its options are derived from the
 * layout names configured in plugin options, plus an explicit "None" option so
 * a template can opt out of the plugin's `defaultLayout`. The field is omitted
 * entirely when no layouts are configured, keeping the collection schema
 * unchanged for projects that do not use layouts.
 */
const createLayoutField = (layoutNames: string[]): Field | null => {
  if (layoutNames.length === 0) {
    return null
  }

  return {
    name: 'layout',
    type: 'select',
    admin: {
      description:
        'Reusable layout to wrap this template body in. The rendered content is injected into the layout\'s {{ content }} slot. Choose "None" to send the body without a layout. When left at "Use default", the plugin\'s defaultLayout (if configured) is applied.',
    },
    defaultValue: 'default',
    options: [
      { label: 'Use default', value: 'default' },
      { label: 'None', value: 'none' },
      ...layoutNames.map((name) => ({ label: name, value: name })),
    ],
  }
}

export const createEmailTemplatesCollection = (
  editor?: RichTextField['editor'],
  layoutNames: string[] = [],
): CollectionConfig => ({
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
        description: 'Email subject line. You can use Liquid variables like {{ firstName }} or {{ siteName }}.',
      },
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description: 'Email content with rich text formatting. Supports Liquid variables like {{ firstName }} and filters like {{ createdAt | formatDate: "long" }}. Content is converted to HTML and plain text automatically. Set templateEngine to "mustache" or "simple" in the plugin config for alternative syntaxes.',
      },
      editor: editor || lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
        ],
      }),
      required: true,
    },
    // Only present when layouts are configured; filtered out otherwise.
    ...([createLayoutField(layoutNames)].filter(Boolean) as Field[]),
  ],
  timestamps: true,
})

// Default export for backward compatibility
const EmailTemplates = createEmailTemplatesCollection()
export default EmailTemplates
