/**
 * In-memory store of emails handed to the dev `testEmailAdapter`.
 *
 * The test adapter does not deliver mail; it logs to stdout and records each
 * message here so the dev "Sent emails" page can show exactly what was sent.
 * The store is intentionally ephemeral — it starts empty on every dev server
 * restart, giving each run a fresh mailbox.
 */

export interface CapturedEmail {
  bcc?: string
  cc?: string
  from?: string
  html?: string
  /** Monotonic id assigned on capture; newest emails have the highest id. */
  id: number
  /** ISO timestamp of when the adapter received the message. */
  sentAt: string
  subject?: string
  text?: string
  to?: string
}

interface Outbox {
  emails: CapturedEmail[]
  nextId: number
}

// Newest dev session aside, a long-running server should not accumulate mail
// forever, so the outbox keeps only the most recent messages.
const MAX_CAPTURED = 100

// Back the outbox with `globalThis` so a single instance is shared across every
// module graph Next.js may evaluate within one dev server process — route
// handlers, pages, and the Payload jobs runtime. A plain module-level array can
// be duplicated across those separate bundles; a `globalThis` slot cannot.
const globalForOutbox = globalThis as unknown as { __sentEmailOutbox?: Outbox }

const outbox: Outbox = globalForOutbox.__sentEmailOutbox ?? { emails: [], nextId: 1 }
globalForOutbox.__sentEmailOutbox = outbox

/** Records a message the test adapter received, newest first. */
export function recordSentEmail(email: Omit<CapturedEmail, 'id' | 'sentAt'>): void {
  outbox.emails.unshift({
    ...email,
    id: outbox.nextId++,
    sentAt: new Date().toISOString(),
  })
  if (outbox.emails.length > MAX_CAPTURED) {
    outbox.emails.length = MAX_CAPTURED
  }
}

/** Returns all captured emails, newest first. */
export function getSentEmails(): CapturedEmail[] {
  return outbox.emails
}

/** Empties the outbox. */
export function clearSentEmails(): void {
  outbox.emails = []
}
