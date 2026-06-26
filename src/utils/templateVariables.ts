import type { BaseEmailTemplateDocument, TemplateVariables } from '../types/index.js'

/**
 * A variable value counts as "missing" when it was never supplied or is blank.
 * `null` and `''` are treated the same as `undefined` so a required variable
 * cannot be satisfied by an empty placeholder. `0` and `false` are valid values.
 */
const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || value === ''

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
    .filter((definition) => definition?.required && definition.name && isMissing(variables?.[definition.name]))
    .map((definition) => definition.name)

  if (missing.length > 0) {
    throw new Error(
      `Missing required template variable(s) for template "${template.slug}": ${missing.join(', ')}`,
    )
  }
}
