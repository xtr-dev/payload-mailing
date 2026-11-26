import type { Config, Field } from 'payload'

import { describe, expect, it } from 'vitest'

import { mailingPlugin } from './plugin.js'

const buildPlugin = (pluginConfig: Parameters<typeof mailingPlugin>[0]) =>
  mailingPlugin(pluginConfig)({ collections: [] } as unknown as Config)

const findField = (fields: Field[], name: string) =>
  fields.find((field) => 'name' in field && field.name === name)

describe('collection slug configuration', () => {
  it('points the default email template relationship at a renamed templates collection', () => {
    const config = buildPlugin({
      collections: {
        templates: 'custom-templates',
      },
    })

    const templates = config.collections?.find(({ slug }) => slug === 'custom-templates')
    const emails = config.collections?.find(({ slug }) => slug === 'emails')
    const templateField = findField(emails?.fields || [], 'template')

    expect(templates?.slug).toBe('custom-templates')
    expect(templateField).toMatchObject({
      name: 'template',
      type: 'relationship',
      relationTo: 'custom-templates',
    })
  })

  it('remaps a caller-supplied email template relationship field', () => {
    const customTemplateField = {
      name: 'template',
      type: 'relationship',
      relationTo: 'legacy-templates',
    } as const satisfies Field

    const config = buildPlugin({
      collections: {
        emails: {
          fields: [customTemplateField],
        },
        templates: 'custom-templates',
      },
    })

    const emails = config.collections?.find(({ slug }) => slug === 'emails')
    const templateField = findField(emails?.fields || [], 'template')

    expect(templateField).toMatchObject({
      name: 'template',
      type: 'relationship',
      relationTo: 'custom-templates',
    })
  })
})
