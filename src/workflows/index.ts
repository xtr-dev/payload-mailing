import { sendEmailWorkflow } from './sendEmailWorkflow.js'

/**
 * All mailing-related workflows that get registered with Payload
 */
export const mailingWorkflows = [
  sendEmailWorkflow,
]

// Re-export everything from individual workflow files
export * from './sendEmailWorkflow.js'