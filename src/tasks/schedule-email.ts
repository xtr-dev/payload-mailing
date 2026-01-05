import type { TaskConfig, TaskHandler } from 'payload'
import { sendEmail } from '../sendEmail.js'

export interface ScheduleEmailInput {
  to: string | string[]
  from?: string
  fromName?: string
  subject?: string
  templateSlug?: string
  templateVariables?: Record<string, unknown>
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  scheduledAt?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  processImmediately?: boolean
}

export interface ScheduleEmailOutput {
  emailId: string | number
  status: string
  scheduledAt?: string
}

// Map string priority to numeric value
const priorityMap: Record<string, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
}

// Ensure value is an array of strings
const ensureStringArray = (value: string | string[] | undefined): string[] | undefined => {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

/**
 * Handler for the schedule-email task.
 * Creates/schedules an email using the payload-mailing service.
 */
const scheduleEmailHandler: TaskHandler<'schedule-email'> = async ({ input, req }) => {
  try {
    const payload = req.payload
    const typedInput = (input ?? {}) as unknown as ScheduleEmailInput

    if (!typedInput.to) {
      return {
        output: {
          errorMessage: 'Recipient "to" is required',
        },
      }
    }

    // Either template or direct content must be provided
    if (!typedInput.templateSlug && !typedInput.html && !typedInput.text) {
      return {
        output: {
          errorMessage: 'Either templateSlug or html/text content is required',
        },
      }
    }

    // Build email options with properly typed values
    const toArray = ensureStringArray(typedInput.to)
    const ccArray = ensureStringArray(typedInput.cc)
    const bccArray = ensureStringArray(typedInput.bcc)
    const priorityValue = typedInput.priority ? priorityMap[typedInput.priority] : 2

    const emailOptions: Parameters<typeof sendEmail>[1] = {
      processImmediately: typedInput.processImmediately ?? false,
      data: {
        to: toArray,
        from: typedInput.from,
        fromName: typedInput.fromName,
        cc: ccArray,
        bcc: bccArray,
        replyTo: typedInput.replyTo,
        priority: priorityValue,
        scheduledAt: typedInput.scheduledAt,
      },
    }

    // Use template if provided
    if (typedInput.templateSlug) {
      emailOptions.template = {
        slug: typedInput.templateSlug,
        variables: (typedInput.templateVariables as Record<string, unknown>) || {},
      }
    } else {
      // Use direct content
      emailOptions.data = {
        ...emailOptions.data,
        subject: typedInput.subject,
        html: typedInput.html,
        text: typedInput.text,
      }
    }

    const email = await sendEmail(payload, emailOptions)

    return {
      output: {
        emailId: String(email.id),
        status: (email as { status?: string }).status || 'pending',
        scheduledAt: typedInput.scheduledAt,
      },
    }
  } catch (error) {
    return {
      output: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error scheduling email',
      },
    }
  }
}

/**
 * PayloadCMS task for scheduling emails via payload-mailing.
 *
 * This task can be used:
 * 1. Standalone - queue it directly with payload.jobs.queue()
 * 2. With @xtr-dev/payload-automation - as a workflow step
 *
 * @example Standalone usage
 * ```typescript
 * // Register the task in your Payload config
 * import { ScheduleEmailTask } from '@xtr-dev/payload-mailing/tasks'
 *
 * export default buildConfig({
 *   jobs: {
 *     tasks: [ScheduleEmailTask]
 *   }
 * })
 *
 * // Queue an email job
 * await payload.jobs.queue({
 *   task: 'schedule-email',
 *   input: { to: 'user@example.com', templateSlug: 'welcome' }
 * })
 * ```
 *
 * @example With payload-automation
 * ```typescript
 * import { workflowsPlugin } from '@xtr-dev/payload-automation/server'
 * import { ScheduleEmailTask } from '@xtr-dev/payload-mailing/tasks'
 *
 * export default buildConfig({
 *   plugins: [
 *     workflowsPlugin({
 *       steps: [ScheduleEmailTask],
 *       collectionTriggers: {
 *         orders: { afterChange: true }
 *       }
 *     })
 *   ]
 * })
 * ```
 */
export const ScheduleEmailTask = {
  slug: 'schedule-email',
  label: 'Schedule Email',
  handler: scheduleEmailHandler,
  inputSchema: [
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: {
        description:
          'Recipient email address(es). Use JSONata for dynamic values (e.g., "trigger.doc.customer.email")',
      },
    },
    {
      name: 'templateSlug',
      type: 'text',
      admin: {
        description: 'Email template slug to use. Either template or direct content (html/text) is required.',
      },
    },
    {
      name: 'templateVariables',
      type: 'json',
      admin: {
        description: 'Variables to pass to the template (JSON object)',
      },
    },
    {
      name: 'subject',
      type: 'text',
      admin: {
        description: 'Email subject (only used when not using a template)',
      },
    },
    {
      name: 'html',
      type: 'textarea',
      admin: {
        description: 'HTML email content (only used when not using a template)',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      admin: {
        description: 'Plain text email content (only used when not using a template)',
      },
    },
    {
      name: 'from',
      type: 'text',
      admin: {
        description: 'Sender email address (uses default from mailing config if not provided)',
      },
    },
    {
      name: 'fromName',
      type: 'text',
      admin: {
        description: 'Sender display name',
      },
    },
    {
      name: 'cc',
      type: 'text',
      admin: {
        description: 'CC recipients (comma-separated or array)',
      },
    },
    {
      name: 'bcc',
      type: 'text',
      admin: {
        description: 'BCC recipients (comma-separated or array)',
      },
    },
    {
      name: 'replyTo',
      type: 'text',
      admin: {
        description: 'Reply-to email address',
      },
    },
    {
      name: 'scheduledAt',
      type: 'text',
      admin: {
        description: 'ISO date string for when to send the email (leave empty to send immediately)',
      },
    },
    {
      name: 'priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      defaultValue: 'normal',
      admin: {
        description: 'Email priority level',
      },
    },
    {
      name: 'processImmediately',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Process and send the email immediately instead of queuing',
      },
    },
  ],
  outputSchema: [
    {
      name: 'emailId',
      type: 'text',
      admin: {
        description: 'ID of the created email record',
      },
    },
    {
      name: 'status',
      type: 'text',
      admin: {
        description: 'Status of the email (pending, sent, etc.)',
      },
    },
    {
      name: 'scheduledAt',
      type: 'text',
      admin: {
        description: 'Scheduled send time if provided',
      },
    },
  ],
} satisfies TaskConfig<'schedule-email'>

export default ScheduleEmailTask
