/**
 * Request-context key that tells the Emails collection's afterChange hook not
 * to queue a `process-email` job for this write. The send path sets it when it
 * puts a failed email back to `pending`, because it queues its own delayed
 * retry job instead.
 */
export const SKIP_EMAIL_JOB_CONTEXT_KEY = 'mailingSkipEmailJob'
