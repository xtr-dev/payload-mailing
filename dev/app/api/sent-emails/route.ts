import { clearSentEmails, getSentEmails } from '../../../helpers/sentOutbox.js'

// Avoid any route-level caching so the page always reflects the live outbox.
export const dynamic = 'force-dynamic'

/** Returns the emails captured by the test adapter, newest first. */
export function GET() {
  return Response.json({ emails: getSentEmails() })
}

/** Empties the captured outbox. */
export function DELETE() {
  clearSentEmails()
  return Response.json({ success: true })
}
