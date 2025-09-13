import { renderTemplate } from '../utils/helpers.js'

export interface SendTemplateEmailInput {
  templateSlug: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  variables?: Record<string, any>
  scheduledAt?: string // ISO date string
  priority?: number
  // Allow any additional fields that users might have in their email collection
  [key: string]: any
}

export const sendTemplateEmailTask = {
  slug: 'send-template-email',
  label: 'Send Template Email',
  inputSchema: [
    {
      name: 'templateSlug',
      type: 'text' as const,
      required: true,
      label: 'Template Slug',
      admin: {
        description: 'The slug of the email template to render'
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
      name: 'variables',
      type: 'json' as const,
      label: 'Template Variables',
      admin: {
        description: 'JSON object with variables for template rendering'
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
      admin: {
        description: 'Email priority (1 = highest, 10 = lowest)'
      }
    }
  ],
  handler: async ({ input, payload }: any) => {
    // Cast input to our expected type
    const taskInput = input as SendTemplateEmailInput

    try {
      // Render the template
      const { html, text, subject } = await renderTemplate(
        payload,
        taskInput.templateSlug,
        taskInput.variables || {}
      )

      // Parse email addresses
      const parseEmails = (emails: string | string[] | undefined): string[] | undefined => {
        if (!emails) return undefined
        if (Array.isArray(emails)) return emails
        return emails.split(',').map(email => email.trim()).filter(Boolean)
      }

      // Prepare email data
      const emailData: any = {
        to: parseEmails(taskInput.to),
        cc: parseEmails(taskInput.cc),
        bcc: parseEmails(taskInput.bcc),
        subject,
        html,
        text,
        priority: taskInput.priority || 5,
      }

      // Add scheduled date if provided
      if (taskInput.scheduledAt) {
        emailData.scheduledAt = new Date(taskInput.scheduledAt).toISOString()
      }

      // Add any additional fields from input (excluding the ones we've already handled)
      const handledFields = ['templateSlug', 'to', 'cc', 'bcc', 'variables', 'scheduledAt', 'priority']
      Object.keys(taskInput).forEach(key => {
        if (!handledFields.includes(key)) {
          emailData[key] = taskInput[key]
        }
      })

      // Create the email in the collection
      const email = await payload.create({
        collection: 'emails', // Default collection name
        data: emailData
      })

      return {
        success: true,
        emailId: email.id,
        message: `Email queued successfully with ID: ${email.id}`,
        templateSlug: taskInput.templateSlug,
        recipients: emailData.to?.length || 0,
        scheduledAt: emailData.scheduledAt || null
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        error: errorMessage,
        templateSlug: taskInput.templateSlug,
        message: `Failed to queue email: ${errorMessage}`
      }
    }
  }
}

export default sendTemplateEmailTask