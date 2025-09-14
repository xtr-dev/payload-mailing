import type { Payload } from 'payload'

/**
 * Processes a single email by ID using the mailing service
 * @param payload Payload instance
 * @param emailId The ID of the email to process
 * @returns Promise that resolves when email is processed
 */
export async function processEmailById(payload: Payload, emailId: string): Promise<void> {
  // Get mailing context from payload
  const mailingContext = (payload as any).mailing

  if (!mailingContext) {
    throw new Error(
      'Mailing plugin not found on payload instance. ' +
      'Ensure the mailingPlugin is properly configured in your Payload config plugins array.'
    )
  }

  if (!mailingContext.service) {
    throw new Error(
      'Mailing service not available. ' +
      'The plugin may not have completed initialization. ' +
      'Check that email configuration is properly set up in your Payload config.'
    )
  }

  // Process the specific email
  await mailingContext.service.processEmailItem(emailId)
}

/**
 * Processes all pending and failed emails using the mailing service
 * @param payload Payload instance
 * @returns Promise that resolves when all emails are processed
 */
export async function processAllEmails(payload: Payload): Promise<void> {
  // Get mailing context from payload
  const mailingContext = (payload as any).mailing

  if (!mailingContext) {
    throw new Error(
      'Mailing plugin not found on payload instance. ' +
      'Ensure the mailingPlugin is properly configured in your Payload config plugins array.'
    )
  }

  if (!mailingContext.service) {
    throw new Error(
      'Mailing service not available. ' +
      'The plugin may not have completed initialization. ' +
      'Check that email configuration is properly set up in your Payload config.'
    )
  }

  // Process pending emails first
  await mailingContext.service.processEmails()

  // Then retry failed emails
  await mailingContext.service.retryFailedEmails()
}