/**
 * Marks a template variable that carries a different value for the HTML part
 * and for the plain-text part (and subject) of an email. A registry symbol
 * (`Symbol.for`) is used rather than a class so the marker still works when
 * the host ends up with two copies of this package.
 */
const PER_PART = Symbol.for('@xtr-dev/payload-mailing/perPart')

export interface PerPartValue<THtml = unknown, TText = unknown> {
  html: THtml
  readonly [PER_PART]: true
  text: TText
}

export type EmailPart = 'html' | 'text'

/**
 * Gives a template variable one value for the HTML body and another for the
 * plain-text body and the subject. Use it for values that hold markup:
 *
 * ```ts
 * variables: {
 *   button: perPart({
 *     html: '<a href="https://example.com/login">Log in</a>',
 *     text: 'Log in: https://example.com/login',
 *   }),
 * }
 * ```
 *
 * The HTML value is still HTML-escaped by default; use `{{ button | raw }}`
 * (LiquidJS) or `{{{ button }}}` (Mustache) to insert it as markup. When the
 * email is stored, the variable is saved as a plain `{ html, text }` object.
 */
export function perPart<THtml, TText>(values: { html: THtml; text: TText }): PerPartValue<THtml, TText> {
  return { html: values.html, [PER_PART]: true, text: values.text }
}

/** True when `value` was created with {@link perPart}. */
export function isPerPartValue(value: unknown): value is PerPartValue {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[PER_PART] === true
}

/**
 * Returns a copy of `variables` in which every {@link perPart} value (at any
 * depth, including inside arrays) is replaced by its value for `part`. Plain
 * objects and arrays are copied only when they contain such a value; other
 * values (dates, class instances, primitives) are passed through untouched.
 */
export function resolvePartVariables<T>(variables: T, part: EmailPart): T {
  return resolveValue(variables, part, new WeakSet()) as T
}

// `seen` holds the objects and arrays on the current path. A value that refers
// back to one of them (a cyclic structure) is returned as-is instead of
// recursing forever.
function resolveValue(value: unknown, part: EmailPart, seen: WeakSet<object>): unknown {
  if (isPerPartValue(value)) {
    return value[part]
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {return value}
    seen.add(value)
    let changed = false
    const out = value.map((item) => {
      const resolved = resolveValue(item, part, seen)
      if (resolved !== item) {changed = true}
      return resolved
    })
    seen.delete(value)
    return changed ? out : value
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) {return value}
    seen.add(value)
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const resolved = resolveValue(item, part, seen)
      if (resolved !== item) {changed = true}
      out[key] = resolved
    }
    seen.delete(value)
    return changed ? out : value
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {return false}
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
