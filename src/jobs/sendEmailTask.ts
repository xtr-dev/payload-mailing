import { sendEmail } from '../sendEmail.js'
import {Email, EmailTemplate} from '../payload-types.js'
import {BaseEmail} from "../types/index.js"

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
  scheduledAt?: string // ISO date string
  priority?: number

  // Allow any additional fields that users might have in their email collection
  [key: string]: any
}

export const sendEmailJob = {
  slug: 'send-email',
  label: 'Send Email',
  inputSchema: [
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
      name: 'scheduledAt',
      type: 'date' as const,
      label: 'Schedule For',
      admin: {
        description: 'Optional date/time to schedule email for future delivery'
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

    try {
      // Prepare options for sendEmail based on task input
      const sendEmailOptions: any = {
        data: {}
      }

      // If using template mode
      if (taskInput.templateSlug) {
        sendEmailOptions.template = {
          slug: taskInput.templateSlug,
          variables: taskInput.variables || {}
        }
      }

      // Build data object from task input
      const dataFields = ['to', 'cc', 'bcc', 'subject', 'html', 'text', 'scheduledAt', 'priority']
      const additionalFields: string[] = []

      // Copy standard fields
      dataFields.forEach(field => {
        if (taskInput[field] !== undefined) {
          sendEmailOptions.data[field] = taskInput[field]
        }
      })

      // Copy any additional custom fields
      Object.keys(taskInput).forEach(key => {
        if (!['templateSlug', 'variables', ...dataFields].includes(key)) {
          sendEmailOptions.data[key] = taskInput[key]
          additionalFields.push(key)
        }
      })

      // Use the sendEmail helper to create the email
      const email = await sendEmail<Email, EmailTemplate>(payload, sendEmailOptions)

      return {
        output: {
          success: true,
          id: email.id,
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to queue email: ${errorMessage}`)
    }
  }
}

export default sendEmailJob
