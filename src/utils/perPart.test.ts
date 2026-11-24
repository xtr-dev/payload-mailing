import { describe, expect, test } from 'vitest'

import { isPerPartValue, perPart, resolvePartVariables } from './perPart.js'

describe('perPart / resolvePartVariables', () => {
  test('picks the value for the requested part, at any depth', () => {
    const vars = {
      name: 'Ann',
      items: [perPart({ html: '<li>a</li>', text: '- a' })],
      nested: { cta: perPart({ html: '<b>go</b>', text: 'go' }) },
    }
    expect(resolvePartVariables(vars, 'html')).toEqual({
      name: 'Ann',
      items: ['<li>a</li>'],
      nested: { cta: '<b>go</b>' },
    })
    expect(resolvePartVariables(vars, 'text')).toEqual({
      name: 'Ann',
      items: ['- a'],
      nested: { cta: 'go' },
    })
  })

  test('leaves variables without perPart values untouched (same reference)', () => {
    const date = new Date('2026-01-01')
    const vars = { date, list: [1, 2], user: { name: 'Ann' } }
    const resolved = resolvePartVariables(vars, 'html')
    expect(resolved).toBe(vars)
    expect(resolved.date).toBe(date)
  })

  test('a plain { html, text } object is not treated as a per-part value', () => {
    const vars = { block: { html: '<p>x</p>', text: 'x' } }
    expect(isPerPartValue(vars.block)).toBe(false)
    expect(resolvePartVariables(vars, 'text')).toBe(vars)
  })

  test('serializes to a plain { html, text } object for storage', () => {
    expect(JSON.parse(JSON.stringify({ v: perPart({ html: '<b>x</b>', text: 'x' }) }))).toEqual({
      v: { html: '<b>x</b>', text: 'x' },
    })
  })
})
