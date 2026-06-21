export { default as Emails } from './collections/Emails.js'

// Collections
export { createEmailTemplatesCollection, default as EmailTemplates } from './collections/EmailTemplates.js'

// Jobs (includes the individual email processing job)
export { mailingJobs } from './jobs/index.js'

export type { ProcessEmailJobInput } from './jobs/processEmailJob.js'
// Main plugin export
export { default as mailingPluginDefault, mailingPlugin } from './plugin.js'

// Main email sending function
export { sendEmail, type SendEmailOptions } from './sendEmail.js'
export { default as sendEmailDefault } from './sendEmail.js'

// Services
export { MailingService } from './services/MailingService.js'
// Types
export * from './types/index.js'

// Email processing utilities
export { processAllEmails, processEmailById, processJobById } from './utils/emailProcessor.js'

// Utility functions for developers
export {
  getMailing,
  parseAndValidateEmails,
  processEmails,
  renderTemplate,
  retryFailedEmails,
  sanitizeDisplayName,
  sanitizeFromName,
} from './utils/helpers.js'

// Job scheduling utilities
export { ensureEmailJob, findExistingJobs, updateEmailJobRelationship } from './utils/jobScheduler.js'