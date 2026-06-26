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

/**
 * Builds the in-admin render-preview fields: a `sampleVariables` JSON input that
 * seeds the preview, and a `preview` UI field that renders the live HTML and
 * plain-text output via the plugin's client component. Returns an empty array
 * when the preview is disabled, leaving the collection schema unchanged.
 *
 * The component is referenced by its package client-export path so the host app
 * resolves it through its generated importMap.
 */
const createPreviewFields = (enablePreview: boolean): Field[] => {
  if (!enablePreview) {
    return []
  }

  return [
    {
      name: 'sampleVariables',
      type: 'json',
      admin: {
        description:
          'Sample variables used to render the live preview below (e.g. {"firstName": "Ada"}). Only used for previewing — not stored on sent emails.',
      },
      defaultValue: {},
    },
    {
      name: 'preview',
      type: 'ui',
      admin: {
        components: {
          Field: '@xtr-dev/payload-mailing/client#TemplatePreview',
        },
      },
    },
  ]
}

export const createEmailTemplatesCollection = (
  editor?: RichTextField['editor'],
  layoutNames: string[] = [],
  enablePreview = false,
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
    {
      name: 'variables',
      type: 'array',
      admin: {
        description:
          'Declare the variables this template expects. Variables marked Required must be supplied with a non-empty value when sending, otherwise the send is rejected before any email is queued. Leave empty to accept any variables.',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          admin: {
            description: 'Variable name as referenced in the template, e.g. firstName (without the {{ }}).',
          },
          required: true,
        },
        {
          name: 'required',
          type: 'checkbox',
          admin: {
            description: 'Reject sends that omit this variable or pass an empty value.',
          },
          defaultValue: false,
        },
        {
          name: 'description',
          type: 'text',
          admin: {
            description: 'Optional note describing what this variable is for.',
          },
        },
      ],
      labels: {
        plural: 'Variables',
        singular: 'Variable',
      },
    },
    // Only present when layouts are configured; filtered out otherwise.
    ...([createLayoutField(layoutNames)].filter(Boolean) as Field[]),
    // In-admin render preview (sampleVariables + preview UI); empty when disabled.
    ...createPreviewFields(enablePreview),
  ],
  timestamps: true,
})

// Default export for backward compatibility
const EmailTemplates = createEmailTemplatesCollection()
export default EmailTemplates
