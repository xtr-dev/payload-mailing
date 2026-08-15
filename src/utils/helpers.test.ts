import { describe, expect, test } from 'vitest'

import { sanitizeDisplayName, sanitizeFromName } from './helpers.js'

describe('sanitizeDisplayName', () => {
  test('strips CR and LF so a crafted value cannot inject a header', () => {
    const sanitized = sanitizeDisplayName('Evil\r\nBcc: attacker@evil.com')
    expect(sanitized).not.toMatch(/[\r\n]/)
    expect(sanitized).toBe('Evil  Bcc: attacker@evil.com')
  })

  test('strips control characters beyond CR/LF', () => {
    const sanitized = sanitizeDisplayName('Al\x00ice\x1F')
    expect(sanitized).toBe('Alice')
  })

  test('escapes embedded quotes only when escapeQuotes is true', () => {
    expect(sanitizeDisplayName('Say "Hi"', true)).toBe('Say \\"Hi\\"')
    expect(sanitizeDisplayName('Say "Hi"')).toBe('Say "Hi"')
    expect(sanitizeDisplayName('Say "Hi"', false)).toBe('Say "Hi"')
  })

  test('trims surrounding whitespace', () => {
    expect(sanitizeDisplayName('  Ada Lovelace  ')).toBe('Ada Lovelace')
  })

  test('returns falsy input unchanged', () => {
    expect(sanitizeDisplayName('')).toBe('')
  })
})

describe('sanitizeFromName', () => {
  test('sanitizes a valid name without escaping quotes', () => {
    expect(sanitizeFromName('Evil\r\nBcc: attacker@evil.com')).toBe('Evil  Bcc: attacker@evil.com')
    expect(sanitizeFromName('Say "Hi"')).toBe('Say "Hi"')
  })

  test('returns undefined for null, undefined, and empty string', () => {
    expect(sanitizeFromName(null)).toBeUndefined()
    expect(sanitizeFromName(undefined)).toBeUndefined()
    expect(sanitizeFromName('')).toBeUndefined()
  })

  test('returns undefined when a name becomes empty only after sanitizing', () => {
    expect(sanitizeFromName('\r\n')).toBeUndefined()
    expect(sanitizeFromName('   ')).toBeUndefined()
  })
})
