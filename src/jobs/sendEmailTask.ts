import { renderTemplate } from '../utils/helpers.js'

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
  handler: async ({ input, payload }: any) => {
    // Cast input to our expected type
    const taskInput = input as SendEmailTaskInput

    try {
      let html: string
      let text: string | undefined
      let subject: string

      // Check if using template or direct email
      if (taskInput.templateSlug) {
        // Template mode: render the template
        const rendered = await renderTemplate(
          payload,
          taskInput.templateSlug,
          taskInput.variables || {}
        )
        html = rendered.html
        text = rendered.text
        subject = rendered.subject
      } else {
        // Direct email mode: use provided content
        if (!taskInput.subject || !taskInput.html) {
          throw new Error('Subject and HTML content are required when not using a template')
        }
        subject = taskInput.subject
        html = taskInput.html
        text = taskInput.text
      }

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
        mode: taskInput.templateSlug ? 'template' : 'direct',
        templateSlug: taskInput.templateSlug || null,
        subject: subject,
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

export default sendEmailJob