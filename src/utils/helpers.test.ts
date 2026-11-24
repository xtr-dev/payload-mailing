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
})

describe('sanitizeFromName', () => {
  test.each([null, undefined, ''] as const)('returns undefined for an absent value (%s)', (fromName) => {
    expect(sanitizeFromName(fromName)).toBeUndefined()
  })

  test('returns undefined when sanitization removes the entire value', () => {
    expect(sanitizeFromName('\x00\x01')).toBeUndefined()
  })
})
