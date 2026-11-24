import { describe, expect, test } from 'vitest'

import { parseAndValidateEmails, sanitizeDisplayName, sanitizeFromName } from './helpers.js'

describe('parseAndValidateEmails', () => {
  test('parses a comma-separated string, trimming whitespace and dropping empty segments', () => {
    expect(parseAndValidateEmails('a@b.com, c@d.com')).toEqual(['a@b.com', 'c@d.com'])
    expect(parseAndValidateEmails('a@b.com,,')).toEqual(['a@b.com'])
  })

  test('passes an array through unchanged', () => {
    const emails = ['a@b.com', 'c@d.com']

    expect(parseAndValidateEmails(emails)).toBe(emails)
  })

  test('passes an array through without re-splitting entries on comma', () => {
    // A single array entry that happens to contain a comma is the caller's
    // already-parsed value and must not be exploded into two addresses. If it
    // were split, 'a@example.com' and 'not-split@example.com' would both be
    // valid individually and the bug would pass silently; asserting on the
    // combined string being rejected as one invalid address is what actually
    // distinguishes "not split" from "split".
    expect(() => parseAndValidateEmails(['a@example.com,not-split@example.com'])).toThrow(
      'Invalid email addresses: a@example.com,not-split@example.com',
    )
  })

  test('rejects an address carrying a CR/LF header-injection payload', () => {
    expect(() => parseAndValidateEmails('victim@example.com\r\nBcc: evil@evil.com')).toThrow('Invalid email addresses')
  })

  test('rejects an address containing a control character', () => {
    expect(() => parseAndValidateEmails('vic\x00tim@example.com')).toThrow('Invalid email addresses')
  })

  test.each([null, undefined, ''] as const)('returns undefined for an absent value (%s)', (emails) => {
    expect(parseAndValidateEmails(emails)).toBeUndefined()
  })

  test('throws with every invalid address in the message', () => {
    expect(() => parseAndValidateEmails(['ok@b.com', 'bad', 'worse'])).toThrow(
      'Invalid email addresses: bad, worse',
    )
  })

  test.each([
    'a..b@x.com',
    '.a@x.com',
    'a.@x.com',
    'a@.com',
    'a@localhost',
  ])('rejects the invalid address %s', (email) => {
    expect(() => parseAndValidateEmails(email)).toThrow(`Invalid email addresses: ${email}`)
  })

  test('accepts a plus-addressed mailbox on a subdomain', () => {
    expect(parseAndValidateEmails('first.last+tag@sub.example.co.uk')).toEqual([
      'first.last+tag@sub.example.co.uk',
    ])
  })
})

describe('sanitizeDisplayName', () => {
  test('removes carriage returns and newlines to prevent header injection', () => {
    const sanitized = sanitizeDisplayName('Ada\r\nBcc: attacker@evil.com')

    expect(sanitized).not.toContain('\r')
    expect(sanitized).not.toContain('\n')
  })

  test('strips control characters while preserving ordinary text and spaces', () => {
    expect(sanitizeDisplayName('A\x00B\x1FC')).toBe('ABC')
    expect(sanitizeDisplayName('Ada Lovelace')).toBe('Ada Lovelace')
  })

  test('keeps quotes bare by default and escapes them when requested', () => {
    const displayName = 'Ada "The" Lovelace'

    expect(sanitizeDisplayName(displayName)).toBe(displayName)
    expect(sanitizeDisplayName(displayName, true)).toBe('Ada \\"The\\" Lovelace')
  })

  test('replaces CR/LF with a space to prevent header injection', () => {
    expect(sanitizeDisplayName('Evil\r\nBcc: evil@evil.com')).toBe('Evil  Bcc: evil@evil.com')
  })

  test('trims surrounding whitespace', () => {
    expect(sanitizeDisplayName('  Jane Doe  ')).toBe('Jane Doe')
  })

  test('passes falsy input through unchanged', () => {
    expect(sanitizeDisplayName('')).toBe('')
  })
})

describe('sanitizeFromName', () => {
  test.each([null, undefined, ''] as const)('returns undefined for an absent value (%s)', (fromName) => {
    expect(sanitizeFromName(fromName)).toBeUndefined()
  })

  test('returns undefined when sanitization removes the entire value', () => {
    expect(sanitizeFromName('\x00\x01')).toBeUndefined()
  })

  test('strips a CR/LF header-injection payload from a fromName', () => {
    expect(sanitizeFromName('Evil\r\nBcc: evil@evil.com')).toBe('Evil  Bcc: evil@evil.com')
  })

  test('does not escape quotes — that only happens at header-build time, not here', () => {
    expect(sanitizeFromName('"Jane" Doe')).toBe('"Jane" Doe')
  })
})
