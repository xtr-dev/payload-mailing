import { describe, expect, test } from 'vitest'

import { parseAndValidateEmails, sanitizeDisplayName, sanitizeFromName } from './helpers.js'

describe('parseAndValidateEmails', () => {
  test('undefined, null and empty string all normalize to undefined', () => {
    expect(parseAndValidateEmails(undefined)).toBeUndefined()
    expect(parseAndValidateEmails(null)).toBeUndefined()
    expect(parseAndValidateEmails('')).toBeUndefined()
  })

  test('splits a comma-separated string and trims each address', () => {
    expect(parseAndValidateEmails('a@example.com, b@example.com ,c@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ])
  })

  test('passes an array through without re-splitting entries on comma', () => {
    // A single array entry that happens to contain a comma is the caller's
    // already-parsed value and must not be exploded into two addresses.
    expect(parseAndValidateEmails(['a@example.com', 'b@example.com'])).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })

  test('rejects a malformed address', () => {
    expect(() => parseAndValidateEmails('not-an-email')).toThrow(/Invalid email addresses/)
  })

  test('rejects a domain with no dot, a leading/trailing dot, or a doubled dot', () => {
    expect(() => parseAndValidateEmails('user@localhost')).toThrow(/Invalid email addresses/)
    expect(() => parseAndValidateEmails('.user@example.com')).toThrow(/Invalid email addresses/)
    expect(() => parseAndValidateEmails('user.@example.com')).toThrow(/Invalid email addresses/)
    expect(() => parseAndValidateEmails('us..er@example.com')).toThrow(/Invalid email addresses/)
  })

  test('rejects an address carrying a CR/LF header-injection payload', () => {
    expect(() => parseAndValidateEmails('victim@example.com\r\nBcc: evil@evil.com')).toThrow(/Invalid email addresses/)
  })

  test('rejects an address containing a control character', () => {
    expect(() => parseAndValidateEmails('vic\x00tim@example.com')).toThrow(/Invalid email addresses/)
  })

  test('one malformed address in a batch fails the whole batch and names the bad one', () => {
    expect(() => parseAndValidateEmails(['good@example.com', 'bad'])).toThrow('bad')
  })
})

describe('sanitizeDisplayName', () => {
  test('replaces CR/LF with a space to prevent header injection', () => {
    expect(sanitizeDisplayName('Evil\r\nBcc: evil@evil.com')).toBe('Evil  Bcc: evil@evil.com')
  })

  test('strips control characters', () => {
    expect(sanitizeDisplayName('Bad\x00Name')).toBe('BadName')
  })

  test('trims surrounding whitespace', () => {
    expect(sanitizeDisplayName('  Jane Doe  ')).toBe('Jane Doe')
  })

  test('leaves quotes untouched by default', () => {
    expect(sanitizeDisplayName('"Jane" Doe')).toBe('"Jane" Doe')
  })

  test('escapes quotes when escapeQuotes is requested, for building a quoted header value', () => {
    expect(sanitizeDisplayName('"Jane" Doe', true)).toBe('\\"Jane\\" Doe')
  })

  test('passes falsy input through unchanged', () => {
    expect(sanitizeDisplayName('')).toBe('')
  })
})

describe('sanitizeFromName', () => {
  test('null, undefined and empty string all normalize to undefined', () => {
    expect(sanitizeFromName(null)).toBeUndefined()
    expect(sanitizeFromName(undefined)).toBeUndefined()
    expect(sanitizeFromName('')).toBeUndefined()
  })

  test('strips a CR/LF header-injection payload from a fromName', () => {
    expect(sanitizeFromName('Evil\r\nBcc: evil@evil.com')).toBe('Evil  Bcc: evil@evil.com')
  })

  test('a name that is only control characters becomes undefined once sanitized down to empty', () => {
    expect(sanitizeFromName('\r\n\x00')).toBeUndefined()
  })

  test('does not escape quotes — that only happens at header-build time, not here', () => {
    expect(sanitizeFromName('"Jane" Doe')).toBe('"Jane" Doe')
  })
})
