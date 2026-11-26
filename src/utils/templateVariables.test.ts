import { describe, expect, test } from 'vitest'

import { validateRequiredTemplateVariables } from './templateVariables.js'

const template = (variables: any) => ({ slug: 'welcome', variables }) as any

describe('validateRequiredTemplateVariables', () => {
  test('passes when all required variables are present', () => {
    const tpl = template([
      { name: 'firstName', required: true },
      { name: 'siteName', required: false },
    ])
    expect(() => validateRequiredTemplateVariables(tpl, { firstName: 'Ada' })).not.toThrow()
  })

  test('throws listing every missing required variable', () => {
    const tpl = template([
      { name: 'firstName', required: true },
      { name: 'orderId', required: true },
      { name: 'siteName', required: false },
    ])
    expect(() => validateRequiredTemplateVariables(tpl, { siteName: 'Acme' })).toThrow(
      /Missing required template variable\(s\) for template "welcome": firstName, orderId/,
    )
  })

  test('treats null and empty string as missing, but 0 and false as present', () => {
    const tpl = template([
      { name: 'a', required: true },
      { name: 'b', required: true },
      { name: 'count', required: true },
      { name: 'flag', required: true },
    ])
    expect(() => validateRequiredTemplateVariables(tpl, { a: null, b: '', count: 0, flag: false })).toThrow(
      /a, b/,
    )
    expect(() => validateRequiredTemplateVariables(tpl, { a: 'x', b: 'y', count: 0, flag: false })).not.toThrow()
  })

  test('does nothing when the template declares no variables', () => {
    expect(() => validateRequiredTemplateVariables(template(undefined), {})).not.toThrow()
    expect(() => validateRequiredTemplateVariables(template([]), {})).not.toThrow()
  })

  test('ignores declared variables that are not marked required', () => {
    const tpl = template([{ name: 'firstName', required: false }, { name: 'siteName' }])
    expect(() => validateRequiredTemplateVariables(tpl, {})).not.toThrow()
  })

  test('resolves dotted names as paths into nested variables', () => {
    const tpl = template([
      { name: 'user.name', required: true },
      { name: 'order.total.amount', required: true },
    ])
    expect(() =>
      validateRequiredTemplateVariables(tpl, { order: { total: { amount: 0 } }, user: { name: 'Ada' } }),
    ).not.toThrow()
    expect(() => validateRequiredTemplateVariables(tpl, { order: { total: 5 }, user: {} })).toThrow(
      /"welcome": user\.name, order\.total\.amount/,
    )
  })

  test('accepts a top-level key that contains the dots itself', () => {
    const tpl = template([{ name: 'user.name', required: true }])
    expect(() => validateRequiredTemplateVariables(tpl, { 'user.name': 'Ada' })).not.toThrow()
  })
})
