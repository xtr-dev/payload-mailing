import type { MailingPluginConfig } from '../types/index.js'

/**
 * Checks the `locale`, `currency` and `timeZone` plugin options once, when the
 * plugin is configured. Intl throws a RangeError for an invalid value at format
 * time; inside a Liquid filter that error would make the whole template fall
 * back to the simple renderer, so a typo in config would break every email
 * that formats a date or amount. Failing at startup with a clear message
 * avoids that.
 */
export function validateFormattingOptions(
  config: Pick<MailingPluginConfig, 'currency' | 'locale' | 'timeZone'>,
): void {
  const { currency, locale, timeZone } = config

  if (locale !== undefined) {
    try {
      Intl.getCanonicalLocales(locale)
    } catch {
      throw new Error(
        `[payload-mailing] Invalid "locale" option: ${JSON.stringify(locale)}. Use a BCP 47 tag such as "en-US" or "nl-NL".`,
      )
    }
  }

  if (timeZone !== undefined) {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone })
    } catch {
      throw new Error(
        `[payload-mailing] Invalid "timeZone" option: ${JSON.stringify(timeZone)}. Use an IANA time zone such as "Europe/Amsterdam".`,
      )
    }
  }

  if (currency !== undefined) {
    try {
      new Intl.NumberFormat(undefined, { currency, style: 'currency' })
    } catch {
      throw new Error(
        `[payload-mailing] Invalid "currency" option: ${JSON.stringify(currency)}. Use an ISO 4217 code such as "EUR" or "USD".`,
      )
    }
  }
}

/**
 * Runs `format` and, when Intl rejects a value passed from a template (an
 * unknown locale or currency in a filter argument), runs `fallback` instead so
 * one bad argument does not break the whole template render.
 */
export function withIntlFallback<T>(format: () => T, fallback: () => T): T {
  try {
    return format()
  } catch (error) {
    if (error instanceof RangeError) {
      return fallback()
    }
    throw error
  }
}
