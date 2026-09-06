import { describe, expect, test } from 'vitest'

import { parseAndValidateEmails } from './helpers.js'

describe('parseAndValidateEmails', () => {
  test('splits a comma-separated string, trimming whitespace and dropping blanks', () => {
    expect(parseAndValidateEmails('a@b.com, c@d.com')).toEqual(['a@b.com', 'c@d.com'])
    expect(parseAndValidateEmails('a@b.com,   , c@d.com')).toEqual(['a@b.com', 'c@d.com'])
  })

  test('passes an array through unchanged, without re-splitting entries', () => {
    expect(parseAndValidateEmails(['a@b.com', 'c@d.com'])).toEqual(['a@b.com', 'c@d.com'])
  })

  test('does not re-split an array entry that contains a comma', () => {
    // If array entries were joined and re-split on ',', this would silently become
    // two valid recipients (a@b.com, c@d.com) instead of one invalid candidate.
    expect(() => parseAndValidateEmails(['a@b.com,c@d.com'])).toThrow(/a@b\.com,c@d\.com/)
  })

  test('returns undefined for null or undefined input rather than an empty array', () => {
    expect(parseAndValidateEmails(null)).toBeUndefined()
    expect(parseAndValidateEmails(undefined)).toBeUndefined()
  })

  test('throws naming the offending address for an unparseable value', () => {
    expect(() => parseAndValidateEmails('not-an-email')).toThrow(/not-an-email/)
  })

  test('rejects a double dot in the local or domain part', () => {
    expect(() => parseAndValidateEmails('a..b@c.com')).toThrow(/a\.\.b@c\.com/)
  })

  test('rejects a leading dot in the local part', () => {
    expect(() => parseAndValidateEmails('.a@b.com')).toThrow(/\.a@b\.com/)
  })

  test('rejects a trailing dot in the local part', () => {
    expect(() => parseAndValidateEmails('a.@c.com')).toThrow(/a\.@c\.com/)
  })

  test('rejects a dot immediately after the @', () => {
    expect(() => parseAndValidateEmails('a@.c.com')).toThrow(/a@\.c\.com/)
  })

  test('rejects a value carrying a CR or LF, so header injection cannot reach the send path', () => {
    expect(() => parseAndValidateEmails('a@b.com\r\nBcc: evil@x.com')).toThrow()
    expect(() => parseAndValidateEmails('a@b.com\nBcc: evil@x.com')).toThrow()
  })

  test('lists every invalid address when several are invalid at once', () => {
    expect(() => parseAndValidateEmails('a@b.com, not-an-email, ..bad@c.com')).toThrow(
      /not-an-email.*\.\.bad@c\.com/,
    )
  })
})
