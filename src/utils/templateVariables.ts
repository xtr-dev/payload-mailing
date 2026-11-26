import type { BaseEmailTemplateDocument, TemplateVariables } from '../types/index.js'

/**
 * A variable value counts as "missing" when it was never supplied or is blank.
 * `null` and `''` are treated the same as `undefined` so a required variable
 * cannot be satisfied by an empty placeholder. `0` and `false` are valid values.
 */
const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || value === ''

/**
 * Looks up a declared variable name in the supplied variables. A dotted name
 * such as `user.name` is resolved as a path into nested objects, matching how
 * templates reference it (`{{ user.name }}`). A top-level key that itself
 * contains the dots is checked first, so `{ 'user.name': … }` also satisfies it.
 */
const lookupVariable = (variables: TemplateVariables | undefined, name: string): unknown => {
  if (!variables) {return undefined}
  if (Object.prototype.hasOwnProperty.call(variables, name)) {
    return variables[name]
  }
  let value: unknown = variables
  for (const segment of name.split('.')) {
    if (value === null || typeof value !== 'object') {return undefined}
    value = (value as Record<string, unknown>)[segment.trim()]
  }
  return value
}

/**
 * Throws when a template declares required variables that the caller did not
 * supply. Templates with no `variables` declarations (including the draft
 * documents used for the in-admin preview) are not constrained, so this is a
 * no-op for them. Called on the send path so an email is never queued with a
 * required variable left unrendered.
 */
export const validateRequiredTemplateVariables = (
  template: Pick<BaseEmailTemplateDocument, 'slug' | 'variables'>,
  variables: TemplateVariables,
): void => {
  const declared = template.variables
  if (!Array.isArray(declared) || declared.length === 0) {
    return
  }

  const missing = declared
    .filter((definition) => definition?.required && definition.name && isMissing(lookupVariable(variables, definition.name.trim())))
    .map((definition) => definition.name)

  if (missing.length > 0) {
    throw new Error(
      `Missing required template variable(s) for template "${template.slug}": ${missing.join(', ')}`,
    )
  }
}
