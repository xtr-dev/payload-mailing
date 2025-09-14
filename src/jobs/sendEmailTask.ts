import { sendEmail } from '../sendEmail.js'
import { BaseEmailDocument } from '../types/index.js'
import { processEmailById } from '../utils/emailProcessor.js'

export interface SendEmailTaskInput {
  // Template mode fields
  templateSlug?: string
  variables?: Record<string, any>

  // Direct email mode fields
  subject?: string
  html?: string
  text?: string

  // Common fields
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  fromName?: string
  replyTo?: string
  scheduledAt?: string | Date // ISO date string or Date object
  priority?: number
  processImmediately?: boolean // If true, process the email immediately instead of waiting for the queue

  // Allow any additional fields that users might have in their email collection
  [key: string]: any
}

/**
 * Transforms task input into sendEmail options by separating template and data fields
 */
function transformTaskInputToSendEmailOptions(taskInput: SendEmailTaskInput) {
  const sendEmailOptions: any = {
    data: {}
  }

  // If using template mode, set template options
  if (taskInput.templateSlug) {
    sendEmailOptions.template = {
      slug: taskInput.templateSlug,
      variables: taskInput.variables || {}
    }
  }

  // Standard email fields that should be copied to data
  const standardFields = ['to', 'cc', 'bcc', 'from', 'fromName', 'replyTo', 'subject', 'html', 'text', 'scheduledAt', 'priority']

  // Fields that should not be copied to data
  const excludedFields = ['templateSlug', 'variables', 'processImmediately']

  // Copy standard fields to data
  standardFields.forEach(field => {
    if (taskInput[field] !== undefined) {
      sendEmailOptions.data[field] = taskInput[field]
    }
  })

  // Copy any additional custom fields that aren't excluded or standard fields
  Object.keys(taskInput).forEach(key => {
    if (!excludedFields.includes(key) && !standardFields.includes(key)) {
      sendEmailOptions.data[key] = taskInput[key]
    }
  })

  return sendEmailOptions
}

/**
 * Job definition for sending emails
 * Can be used through Payload's job queue system to send emails programmatically
 */
export const sendEmailJob = {
  slug: 'send-email',
  label: 'Send Email',
  inputSchema: [
    {
      name: 'processImmediately',
      type: 'checkbox' as const,
      label: 'Process Immediately',
      defaultValue: false,
      admin: {
        description: 'Process and send the email immediately instead of waiting for the queue processor'
      }
    },
    {
      name: 'templateSlug',
      type: 'text' as const,
      label: 'Template Slug',
      admin: {
        description: 'Use a template (leave empty for direct email)',
        condition: (data: any) => !data.subject && !data.html
      }
    },
    {
      name: 'variables',
      type: 'json' as const,
      label: 'Template Variables',
      admin: {
        description: 'JSON object with variables for template rendering',
        condition: (data: any) => Boolean(data.templateSlug)
      }
    },
    {
      name: 'subject',
      type: 'text' as const,
      label: 'Subject',
      admin: {
        description: 'Email subject (required if not using template)',
        condition: (data: any) => !data.templateSlug
      }
    },
    {
      name: 'html',
      type: 'textarea' as const,
      label: 'HTML Content',
      admin: {
        description: 'HTML email content (required if not using template)',
        condition: (data: any) => !data.templateSlug
      }
    },
    {
      name: 'text',
      type: 'textarea' as const,
      label: 'Text Content',
      admin: {
        description: 'Plain text email content (optional)',
        condition: (data: any) => !data.templateSlug
      }
    },
    {
      name: 'to',
      type: 'text' as const,
      required: true,
      label: 'To (Email Recipients)',
      admin: {
        description: 'Comma-separated list of email addresses'
      }
    },
    {
      name: 'cc',
      type: 'text' as const,
      label: 'CC (Carbon Copy)',
      admin: {
        description: 'Optional comma-separated list of CC email addresses'
      }
    },
    {
      name: 'bcc',
      type: 'text' as const,
      label: 'BCC (Blind Carbon Copy)',
      admin: {
        description: 'Optional comma-separated list of BCC email addresses'
      }
    },
    {
      name: 'from',
      type: 'text' as const,
      label: 'From Email',
      admin: {
        description: 'Optional sender email address (uses default if not provided)'
      }
    },
    {
      name: 'fromName',
      type: 'text' as const,
      label: 'From Name',
      admin: {
        description: 'Optional sender display name (e.g., "John Doe")'
      }
    },
    {
      name: 'replyTo',
      type: 'text' as const,
      label: 'Reply To',
      admin: {
        description: 'Optional reply-to email address'
      }
    },
    {
      name: 'scheduledAt',
      type: 'date' as const,
      label: 'Schedule For',
      admin: {
        description: 'Optional date/time to schedule email for future delivery',
        condition: (data: any) => !data.processImmediately
      }
    },
    {
      name: 'priority',
      type: 'number' as const,
      label: 'Priority',
      min: 1,
      max: 10,
      defaultValue: 5,
      admin: {
        description: 'Email priority (1 = highest, 10 = lowest)'
      }
    }
  ],
  outputSchema: [
    {
      name: 'id',
      type: 'text' as const
    }
  ],
  handler: async ({ input, payload }: any) => {
    // Cast input to our expected type
    const taskInput = input as SendEmailTaskInput
    const shouldProcessImmediately = taskInput.processImmediately || false

    try {
      // Transform task input into sendEmail options using helper function
      const sendEmailOptions = transformTaskInputToSendEmailOptions(taskInput)

      // Use the sendEmail helper to create the email
      const email = await sendEmail<BaseEmailDocument>(payload, sendEmailOptions)

      // If processImmediately is true, process the email now
      if (shouldProcessImmediately) {
        console.log(`⚡ Processing email ${email.id} immediately...`)
        await processEmailById(payload, String(email.id))
        console.log(`✅ Email ${email.id} processed and sent immediately`)

        return {
          output: {
            success: true,
            id: email.id,
            status: 'sent',
            processedImmediately: true
          }
        }
      }

      return {
        output: {
          success: true,
          id: email.id,
          status: 'queued',
          processedImmediately: false
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to process email: ${error.message}`, { cause: error })
      } else {
        throw new Error(`Failed to process email: ${String(error)}`)
      }
    }
  }
}

export default sendEmailJob
