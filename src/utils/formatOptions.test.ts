import { describe, expect, test } from 'vitest'

import { mailingPlugin } from '../plugin.js'
import { validateFormattingOptions } from './formatOptions.js'

describe('validateFormattingOptions', () => {
  test('accepts valid or missing options', () => {
    expect(() => validateFormattingOptions({})).not.toThrow()
    expect(() =>
      validateFormattingOptions({ currency: 'EUR', locale: 'nl-NL', timeZone: 'Europe/Amsterdam' }),
    ).not.toThrow()
  })

  test.each([
    [{ locale: 'en_US' }, /Invalid "locale" option/],
    [{ timeZone: 'Europe/Amsterdm' }, /Invalid "timeZone" option/],
    [{ currency: 'EURO' }, /Invalid "currency" option/],
  ])('rejects %o', (options, message) => {
    expect(() => validateFormattingOptions(options)).toThrow(message)
  })

  test('mailingPlugin throws for an invalid option when the plugin is configured', () => {
    expect(() => mailingPlugin({ timeZone: 'Europe/Amsterdm' })({} as never)).toThrow(/Invalid "timeZone" option/)
  })
})
