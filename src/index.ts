// Main plugin export
export { default as mailingPlugin } from './plugin'
export { mailingPlugin } from './plugin'

// Types
export * from './types'

// Services
export { MailingService } from './services/MailingService'

// Collections
export { default as EmailTemplates } from './collections/EmailTemplates'
export { default as EmailOutbox } from './collections/EmailOutbox'

// Jobs
export * from './jobs'

// Utility functions for developers
export {
  getMailing,
  sendEmail,
  scheduleEmail,
  processOutbox,
  retryFailedEmails,
} from './utils/helpers'