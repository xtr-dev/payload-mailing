import type { Config } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { mailingPlugin } from './plugin.js'

// A stub Payload that satisfies MailingService's initialization checks (it
// throws if `.email` is missing) without needing a real Payload instance.
const stubPayload = () => ({ db: {}, email: {} }) as any

const buildPlugin = (pluginConfig: Record<string, any>, hostOnInit: (payload: any) => void | Promise<void>) =>
  mailingPlugin(pluginConfig as never)({ collections: [], onInit: hostOnInit } as unknown as Config)

describe('onInit ordering (initOrder)', () => {
  it('default (no initOrder): host onInit runs once, with payload.mailing already attached', async () => {
    const seenMailing: unknown[] = []
    const hostOnInit = vi.fn((payload: any) => {
      seenMailing.push(payload.mailing)
    })
    const built = buildPlugin({}, hostOnInit)
    const payload = stubPayload()

    await built.onInit!(payload)

    expect(hostOnInit).toHaveBeenCalledTimes(1)
    expect(seenMailing[0]).toBeDefined()
    expect(payload.mailing).toBeDefined()
  })

  it("initOrder: 'before' behaves the same as the default", async () => {
    const seenMailing: unknown[] = []
    const hostOnInit = vi.fn((payload: any) => {
      seenMailing.push(payload.mailing)
    })
    const built = buildPlugin({ initOrder: 'before' }, hostOnInit)
    const payload = stubPayload()

    await built.onInit!(payload)

    expect(hostOnInit).toHaveBeenCalledTimes(1)
    expect(seenMailing[0]).toBeDefined()
  })

  it("initOrder: 'after': host onInit runs once, before payload.mailing is attached", async () => {
    const seenMailing: unknown[] = []
    const hostOnInit = vi.fn((payload: any) => {
      seenMailing.push(payload.mailing)
    })
    const built = buildPlugin({ initOrder: 'after' }, hostOnInit)
    const payload = stubPayload()

    await built.onInit!(payload)

    expect(hostOnInit).toHaveBeenCalledTimes(1)
    expect(seenMailing[0]).toBeUndefined()
    // Attached after the host's onInit returns, so it's available afterward.
    expect(payload.mailing).toBeDefined()
  })

  it('does not throw when the host config has no onInit', async () => {
    const built = mailingPlugin({} as never)({ collections: [] } as unknown as Config)
    const payload = stubPayload()

    await expect(built.onInit!(payload)).resolves.not.toThrow()
    expect(payload.mailing).toBeDefined()
  })
})
