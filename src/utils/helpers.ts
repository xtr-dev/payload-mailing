import { Payload } from 'payload'
import { TemplateVariables, PayloadID, PayloadRelation } from '../types/index.js'

/**
 * Parse and validate email addresses
 * @internal
 */
export const parseAndValidateEmails = (emails: string | string[] | null | undefined): string[] | undefined => {
  if (!emails || emails === null) return undefined

  let emailList: string[]
  if (Array.isArray(emails)) {
    emailList = emails
  } else {
    emailList = emails.split(',').map(email => email.trim()).filter(Boolean)
  }

  // RFC 5322 compliant email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  const invalidEmails = emailList.filter(email => {
    // Check basic format
    if (!emailRegex.test(email)) return true
    // Check for common invalid patterns
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return true
    if (email.includes('@.') || email.includes('.@')) return true
    // Check domain has at least one dot
    const parts = email.split('@')
    if (parts.length !== 2 || !parts[1].includes('.')) return true
    return false
  })

  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`)
  }

  return emailList
}

/**
 * Sanitize display names to prevent email header injection
 * Removes newlines, carriage returns, and control characters
 * @param displayName - The display name to sanitize
 * @param escapeQuotes - Whether to escape quotes (for email headers)
 * @returns Sanitized display name
 */
export const sanitizeDisplayName = (displayName: string, escapeQuotes = false): string => {
  if (!displayName) return displayName

  let sanitized = displayName
    .trim()
    // Remove/replace newlines and carriage returns to prevent header injection
    .replace(/[\r\n]/g, ' ')
    // Remove control characters (except space and printable characters)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  // Escape quotes if needed (for email headers)
  if (escapeQuotes) {
    sanitized = sanitized.replace(/"/g, '\\"')
  }

  return sanitized
}

/**
 * Sanitize and validate fromName for emails
 * Wrapper around sanitizeDisplayName for consistent fromName handling
 * @param fromName - The fromName to sanitize
 * @returns Sanitized fromName or undefined if empty after sanitization
 */
export const sanitizeFromName = (fromName: string | null | undefined): string | undefined => {
  if (!fromName) return undefined

  const sanitized = sanitizeDisplayName(fromName, false)
  return sanitized.length > 0 ? sanitized : undefined
}

/**
 * Type guard to check if a Payload relation is populated (object) or unpopulated (ID)
 */
export const isPopulated = <T extends { id: PayloadID }>(
  value: PayloadRelation<T> | null | undefined
): value is T => {
  return value !== null && value !== undefined && typeof value === 'object' && 'id' in value
}

/**
 * Resolves a Payload relation to just the ID
 * Handles both populated (object with id) and unpopulated (string/number) values
 */
export const resolveID = <T extends { id: PayloadID }>(
  value: PayloadRelation<T> | null | undefined
): PayloadID | undefined => {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'object' && 'id' in value) {
    return value.id
  }

  return undefined
}

/**
 * Resolves an array of Payload relations to an array of IDs
 * Handles mixed arrays of populated and unpopulated values
 */
export const resolveIDs = <T extends { id: PayloadID }>(
  values: (PayloadRelation<T> | null | undefined)[] | null | undefined
): PayloadID[] => {
  if (!values || !Array.isArray(values)) return []

  return values
    .map(value => resolveID(value))
    .filter((id): id is PayloadID => id !== undefined)
}

export const getMailing = (payload: Payload) => {
  const mailing = (payload as any).mailing
  if (!mailing) {
    throw new Error('Mailing plugin not initialized. Make sure you have added the mailingPlugin to your Payload config.')
  }
  return mailing
}

export const renderTemplate = async (payload: Payload, templateSlug: string, variables: TemplateVariables): Promise<{ html: string; text: string; subject: string }> => {
  const mailing = getMailing(payload)
  return mailing.service.renderTemplate(templateSlug, variables)
}

/**
 * Render a template and return both rendered content and template ID
 * This is used by sendEmail to avoid duplicate template lookups
 * @internal
 */
export const renderTemplateWithId = async (
  payload: Payload,
  templateSlug: string,
  variables: TemplateVariables
): Promise<{ html: string; text: string; subject: string; templateId: PayloadID }> => {
  const mailing = getMailing(payload)
  const templatesCollection = mailing.config.collections?.templates || 'email-templates'

  // Runtime validation: Ensure the collection exists in Payload
  if (!payload.collections[templatesCollection]) {
    throw new Error(
      `Templates collection '${templatesCollection}' not found. ` +
      `Available collections: ${Object.keys(payload.collections).join(', ')}`
    )
  }

  // Look up the template document once
  const { docs: templateDocs } = await payload.find({
    collection: templatesCollection as any,
    where: {
      slug: {
        equals: templateSlug,
      },
    },
    limit: 1,
  })

  if (!templateDocs || templateDocs.length === 0) {
    throw new Error(`Template not found: ${templateSlug}`)
  }

  const templateDoc = templateDocs[0]

  // Render using the document directly to avoid duplicate lookup
  const rendered = await mailing.service.renderTemplateDocument(templateDoc, variables)

  return {
    ...rendered,
    templateId: templateDoc.id,
  }
}

export const processEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.processEmails()
}

export const retryFailedEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.retryFailedEmails()
}