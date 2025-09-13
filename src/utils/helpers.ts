import { Payload } from 'payload'
import { TemplateVariables } from '../types/index.js'

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

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalidEmails = emailList.filter(email => !emailRegex.test(email))
  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`)
  }

  return emailList
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

export const processEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.processEmails()
}

export const retryFailedEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.retryFailedEmails()
}