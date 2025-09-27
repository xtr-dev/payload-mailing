import type { PayloadRequest } from 'payload'
import { processEmailById } from '../utils/emailProcessor.js'

/**
 * Data passed to the individual email processing job
 */
export interface ProcessEmailJobInput {
  /**
   * The ID of the email to process
   */
  emailId: string | number
}

/**
 * Job definition for processing a single email
 */
export const processEmailJob = {
  slug: 'process-email',
  label: 'Process Individual Email',
  inputSchema: [
    {
      name: 'emailId',
      type: 'text' as const,
      required: true,
      label: 'Email ID',
      admin: {
        description: 'The ID of the email to process and send'
      }
    }
  ],
  outputSchema: [
    {
      name: 'success',
      type: 'checkbox' as const
    },
    {
      name: 'emailId',
      type: 'text' as const
    },
    {
      name: 'status',
      type: 'text' as const
    }
  ],
  handler: async ({ input, req }: { input: ProcessEmailJobInput; req: PayloadRequest }) => {
    const payload = (req as any).payload
    const { emailId } = input

    if (!emailId) {
      throw new Error('Email ID is required for processing')
    }

    try {
      // Process the individual email
      await processEmailById(payload, String(emailId))

      return {
        output: {
          success: true,
          emailId: String(emailId),
          status: 'sent',
          message: `Email ${emailId} processed successfully`
        }
      }
    } catch (error) {
      throw new Error(`Failed to process email ${emailId}: ${String(error)}`)
    }
  }
}

export default processEmailJob
