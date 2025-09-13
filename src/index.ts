// Main plugin export
export { mailingPlugin, default as mailingPluginDefault } from './plugin.js'

// Types
export * from './types/index.js'

// Services
export { MailingService } from './services/MailingService.js'

// Collections
export { default as EmailTemplates, createEmailTemplatesCollection } from './collections/EmailTemplates.js'
export { default as Emails } from './collections/Emails.js'

// Tasks
export { sendTemplateEmailTask, default as sendTemplateEmailTaskDefault } from './tasks/sendTemplateEmailTask.js'
export type { SendTemplateEmailInput } from './tasks/sendTemplateEmailTask.js'

// Jobs are integrated into the plugin configuration

// Utility functions for developers
export {
  getMailing,
  renderTemplate,
  processEmails,
  retryFailedEmails,
} from './utils/helpers.js'