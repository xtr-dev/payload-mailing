export { default as Emails } from './collections/Emails.js'

// Collections
export { createEmailTemplatesCollection, default as EmailTemplates } from './collections/EmailTemplates.js'

// Jobs (includes the individual email processing job)
export { mailingJobs } from './jobs/index.js'

export type { ProcessEmailJobInput } from './jobs/processEmailJob.js'
// Main plugin export
export { default as mailingPluginDefault, mailingPlugin } from './plugin.js'

// Main email sending function
export { ImmediateProcessingError, sendEmail, type SendEmailOptions } from './sendEmail.js'
export { default as sendEmailDefault } from './sendEmail.js'

// Services
export { MailingService } from './services/MailingService.js'
export { TemplateRenderError } from './services/templateEngines.js'
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

// Per-part (HTML vs. plain-text) template variable values
export { type EmailPart, isPerPartValue, perPart, type PerPartValue } from './utils/perPart.js'

export type {
  InternalLinkResolver,
  RichTextSerializeOptions,
  SerializedLinkFields,
} from './utils/richTextSerializer.js'

// HTML helpers used by the rich-text serializer, for hosts building direct HTML
export { escapeHtml, safeUrl } from './utils/richTextSerializer.js'

