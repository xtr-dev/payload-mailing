import type { CollectionConfig } from 'payload'

/**
 * Denies an operation for every request. Payload's Local API (used internally by
 * this plugin to create/find/update emails, templates and jobs) bypasses access
 * control by default, so denying here does not affect the plugin's own sending
 * or rendering — it only governs the REST/GraphQL API and the admin panel.
 */
const deny = () => false

/**
 * Secure-by-default access control applied to the mailing collections.
 *
 * Payload's built-in default grants access to *any* authenticated user, which in
 * apps with non-admin/front-end users would expose email content, recipients and
 * templates. To avoid accidentally publicizing these collections, the plugin
 * denies every operation by default. Grant the access your app needs explicitly
 * via the plugin's `collections.emails` / `collections.templates` overrides — the
 * plugin merges your `access` on top of these defaults, so any operation you do
 * not override stays denied.
 */
export const denyAllAccess: NonNullable<CollectionConfig['access']> = {
  create: deny,
  delete: deny,
  read: deny,
  update: deny,
}
