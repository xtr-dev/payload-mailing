import { describe, expect, it, vi } from 'vitest'
import { getPluginLogger } from './logger.js'

function makeMockPayload() {
  const child = vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }))

  return { logger: { child } } as any
}

describe('getPluginLogger', () => {
  it('caches the child logger per Payload instance rather than globally', () => {
    const payloadA = makeMockPayload()
    const payloadB = makeMockPayload()

    const loggerA1 = getPluginLogger(payloadA)
    const loggerA2 = getPluginLogger(payloadA)
    const loggerB = getPluginLogger(payloadB)

    expect(payloadA.logger.child).toHaveBeenCalledTimes(1)
    expect(payloadB.logger.child).toHaveBeenCalledTimes(1)
    expect(loggerA1).toBe(loggerA2)
    expect(loggerA1).not.toBe(loggerB)
  })
})
