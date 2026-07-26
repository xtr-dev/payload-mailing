import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import { mailingPlugin } from './plugin.js'

/**
 * These tests lock in the secure-by-default access behavior: the emails and
 * templates collections must deny every operation unless the host app grants
 * access explicitly through the plugin's collection overrides.
 */
const buildCollections = (config: Config) => {
  const result = mailingPlugin(config as never)({ collections: [] } as unknown as Config)
  const collections = result.collections || []
  return {
    emails: collections.find((c) => c.slug === 'emails')!,
    templates: collections.find((c) => c.slug === 'email-templates')!,
  }
}

// Access functions receive a Payload access args object; the defaults ignore it.
const call = (fn: unknown) => (fn as () => unknown)()

describe('collection access defaults', () => {
  it('denies every operation on both collections by default', () => {
    const { emails, templates } = buildCollections({} as Config)

    for (const collection of [emails, templates]) {
      expect(collection.access).toBeDefined()
      expect(call(collection.access!.read)).toBe(false)
      expect(call(collection.access!.create)).toBe(false)
      expect(call(collection.access!.update)).toBe(false)
      expect(call(collection.access!.delete)).toBe(false)
    }
  })

  it('applies an access override while leaving unspecified operations denied', () => {
    const { emails } = buildCollections({
      collections: {
        emails: {
          access: {
            read: () => true,
          },
        },
      },
    } as unknown as Config)

    // Overridden operation is granted...
    expect(call(emails.access!.read)).toBe(true)
    // ...while the operations the app did not override stay denied.
    expect(call(emails.access!.create)).toBe(false)
    expect(call(emails.access!.update)).toBe(false)
    expect(call(emails.access!.delete)).toBe(false)
  })
})
