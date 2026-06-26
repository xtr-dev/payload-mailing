import type { EmailAdapter, SendEmailOptions } from 'payload'

import { recordSentEmail } from './sentOutbox.js'

/**
 * Logs all emails to stdout and records them in the in-memory outbox so the dev
 * "Sent emails" page can display what was sent.
 */
export const testEmailAdapter: EmailAdapter<void> = ({ payload }) => ({
  name: 'test-email-adapter',
  defaultFromAddress: 'dev@payloadcms.com',
  defaultFromName: 'Payload Test',
  sendEmail: async (message) => {
    const stringifiedTo = getStringifiedToAddress(message)
    const res = `Test email to: '${stringifiedTo}', Subject: '${message.subject}'`
    payload.logger.info({ content: message, msg: res })

    // Capture the exact payload the adapter received so it can be viewed in the
    // dev UI instead of having to scrape it from the server logs.
    recordSentEmail({
      bcc: stringifyAddress(message.bcc),
      cc: stringifyAddress(message.cc),
      from: stringifyAddress(message.from),
      html: typeof message.html === 'string' ? message.html : undefined,
      subject: message.subject,
      text: typeof message.text === 'string' ? message.text : undefined,
      to: stringifiedTo,
    })

    return Promise.resolve()
  },
})

function getStringifiedToAddress(message: SendEmailOptions): string | undefined {
  return stringifyAddress(message.to)
}

/** Renders any of nodemailer's accepted address shapes to a display string. */
function stringifyAddress(
  value:
    | Array<{ address?: string; name?: string } | string>
    | { address?: string; name?: string }
    | string
    | undefined,
): string | undefined {
  if (!value) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.address ?? ''))
      .filter(Boolean)
      .join(', ')
  }
  return value.address
}
