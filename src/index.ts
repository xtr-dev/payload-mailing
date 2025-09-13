// Main plugin export
export { mailingPlugin, default as mailingPluginDefault } from './plugin.js'

// Types
export * from './types/index.js'

// Services
export { MailingService } from './services/MailingService.js'

// Collections
export { default as EmailTemplates, createEmailTemplatesCollection } from './collections/EmailTemplates.js'
export { default as Emails } from './collections/Emails.js'

// Jobs (includes the send email task)
export { mailingJobs, sendEmailJob } from './jobs/index.js'
export type { SendEmailTaskInput } from './jobs/sendEmailTask.js'

// Utility functions for developers
export {
  getMailing,
  renderTemplate,
  processEmails,
  retryFailedEmails,
  sendEmail,
  type BaseEmailData,
  type SendEmailOptions,
} from './utils/helpers.js'