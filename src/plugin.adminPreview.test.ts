import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import { previewTemplateHandler } from './endpoints/previewTemplate.js'
import { mailingPlugin } from './plugin.js'

/**
 * Locks in the documented asymmetry of the `adminPreview` flag:
 *
 *   - `adminPreview: false` omits the preview UI fields (sampleVariables, preview)
 *     from the email-templates collection, BUT the POST /mailing/preview-template
 *     endpoint is still registered unconditionally.
 *
 *   - `adminPreview: true` (or omitted, which defaults to true) includes the
 *     preview UI fields in the collection.
 *
 * The endpoint must always be present because external tooling may call it
 * directly even when the in-admin component is disabled.
 */

const buildResult = (pluginConfig: Record<string, unknown> = {}) => {
  return mailingPlugin(pluginConfig as never)({ collections: [] } as unknown as Config)
}

const getTemplatesFields = (result: ReturnType<typeof buildResult>) => {
  const collections = result.collections || []
  const templates = collections.find((c) => c.slug === 'email-templates')!
  return templates.fields
}

const hasField = (fields: unknown[], name: string) =>
  fields.some(
    (f) => typeof f === 'object' && f !== null && 'name' in f && (f as { name: string }).name === name,
  )

const getPreviewEndpoint = (result: ReturnType<typeof buildResult>) => {
  const endpoints = result.endpoints || []
  return endpoints.find(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      'path' in e &&
      (e as { path: string }).path === '/mailing/preview-template' &&
      'method' in e &&
      (e as { method: string }).method === 'post',
  )
}

describe('adminPreview flag', () => {
  describe('adminPreview: false', () => {
    it('omits sampleVariables and preview UI fields from the templates collection', () => {
      const result = buildResult({ adminPreview: false })
      const fields = getTemplatesFields(result)

      expect(hasField(fields, 'sampleVariables')).toBe(false)
      expect(hasField(fields, 'preview')).toBe(false)
    })

    it('still registers the POST /mailing/preview-template endpoint', () => {
      const result = buildResult({ adminPreview: false })
      const endpoint = getPreviewEndpoint(result)

      expect(endpoint).toBeDefined()
      expect((endpoint as { handler: unknown }).handler).toBe(previewTemplateHandler)
    })
  })

  describe('adminPreview: true', () => {
    it('includes sampleVariables and preview UI fields in the templates collection', () => {
      const result = buildResult({ adminPreview: true })
      const fields = getTemplatesFields(result)

      expect(hasField(fields, 'sampleVariables')).toBe(true)
      expect(hasField(fields, 'preview')).toBe(true)
    })
  })

  describe('adminPreview omitted (default)', () => {
    it('includes preview UI fields — default is enabled', () => {
      const result = buildResult()
      const fields = getTemplatesFields(result)

      expect(hasField(fields, 'sampleVariables')).toBe(true)
      expect(hasField(fields, 'preview')).toBe(true)
    })

    it('still registers the preview endpoint', () => {
      const result = buildResult()
      const endpoint = getPreviewEndpoint(result)

      expect(endpoint).toBeDefined()
    })
  })
})
