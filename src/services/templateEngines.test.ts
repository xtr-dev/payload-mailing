import { describe, expect, test, vi } from 'vitest'

import type { MustacheModule, TemplateEngineAdapter } from './templateEngines.js'

import { MustacheEngineAdapter } from './templateEngines.js'

// A fallback whose render() and renderHtml() are observably different, so a
// test can tell which one MustacheEngineAdapter actually delegated to rather
// than just checking the output looks escaped.
const stubFallback = (): TemplateEngineAdapter => ({
  composeLayout: vi.fn(async (layout, content) => layout.replace('{{content}}', content)),
  render: vi.fn(async () => 'fallback:verbatim'),
  renderHtml: vi.fn(async () => 'fallback:escaped'),
})

describe('MustacheEngineAdapter.renderHtml — error fallback', () => {
  test('falls back to fallback.renderHtml() (escaped), not fallback.render() (verbatim), when mustache.render throws', async () => {
    const throwingMustache: MustacheModule = {
      render: vi.fn(() => {
        throw new Error('boom')
      }),
    }
    const fallback = stubFallback()
    const onError = vi.fn()
    const adapter = new MustacheEngineAdapter(throwingMustache, fallback, onError)

    const result = await adapter.renderHtml('Hello {{ name }}', { name: 'World' })

    expect(result).toBe('fallback:escaped')
    expect(fallback.renderHtml).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' })
    expect(fallback.render).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalled()
  })
})
