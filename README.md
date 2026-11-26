# @xtr-dev/payload-mailing

[![npm version](https://img.shields.io/npm/v/@xtr-dev/payload-mailing.svg)](https://www.npmjs.com/package/@xtr-dev/payload-mailing)

Template-based email for PayloadCMS 3.x — templates, layouts, scheduling, and
job-queue processing, all through Payload collections you already know.

> ⚠️ **Pre-release** (v0.x). Breaking changes may occur before v1.0.0.

## Install

```bash
pnpm add @xtr-dev/payload-mailing @payloadcms/richtext-lexical
```

`@payloadcms/richtext-lexical` is a required peer dependency: the templates
collection uses it as the default rich-text editor. If your app already uses
the Lexical editor (Payload's default), you have it installed already.

## Quick Start

Add the plugin plus an [email adapter](https://payloadcms.com/docs/email/overview):

```typescript
import { buildConfig } from 'payload'
import { mailingPlugin } from '@xtr-dev/payload-mailing'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

export default buildConfig({
  email: nodemailerAdapter({ defaultFromAddress: 'noreply@yoursite.com', transport: { /* SMTP */ } }),
  plugins: [
    mailingPlugin({
      defaultFrom: 'noreply@yoursite.com',
      collections: {
        // Required — collections deny all access by default. See "Access Control".
        // Grant staff only: sent emails contain sign-in links and other per-recipient secrets.
        emails: { access: { read: ({ req: { user } }) => user?.role === 'admin' } },
        templates: { access: { read: ({ req: { user } }) => user?.role === 'admin' } },
      },
    }),
  ],
})
```

This adds two collections under a **Mailing** admin group: `email-templates`
(author templates) and `emails` (delivery + status tracking).

## Access Control

**The mailing collections deny every operation by default.** Payload's built-in
default grants access to *any* authenticated user, which in an app with
front-end/non-admin users would expose email content, recipients, and templates.
Until you grant access explicitly, no one can read or manage these collections
via the REST/GraphQL API or admin panel — but sending still works, since the
plugin sends through Payload's Local API (which bypasses access control).

Grant access via the collection overrides. Your functions are merged **on top
of** the deny-all default, so any operation you don't set stays denied:

```typescript
mailingPlugin({
  collections: {
    emails: {
      access: {
        read:   ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    // templates: { access: { … } }
  },
})
```

Keep `emails` staff-only. Each sent email stores its `variables` and rendered
body, which often hold sign-in links, confirmation links and one-time codes, so
granting `read` to every signed-in user lets any account take over another.
Granting `create` lets any account send mail from your domain. Your app's own
code sends through `sendEmail` (Local API) and needs no access rule.

`access` is the standard [Payload access control](https://payloadcms.com/docs/access-control/collections)
API. The same override object also accepts custom `fields`, `hooks`, `admin`, etc.

## Sending Email

```typescript
import { sendEmail } from '@xtr-dev/payload-mailing'

// From a template
await sendEmail(payload, {
  template: { slug: 'welcome-email', variables: { firstName: 'John' } },
  data: {
    to: 'user@example.com',
    scheduledAt: new Date(Date.now() + 3600_000), // optional: send later
    priority: 1,                                   // optional: 1 = highest
  },
})

// Or with your own content
await sendEmail(payload, {
  data: { to: 'user@example.com', subject: 'Hi', html: '<h1>Hi</h1>' },
})
```

Emails are queued and sent in the background (see [Jobs](#jobs)). Pass
`processImmediately: true` to send synchronously, or `queue` to route a single
send's job onto a named queue (e.g. `'high'`) instead of the plugin's `queue`
option.

If `processImmediately` creates and queues the email but running its job inline
fails, `sendEmail` throws an `ImmediateProcessingError`. The email is still in the
outbox with its job and goes out on the next queue run. Its `email` and `jobId`
properties tell you which email it was, so you can treat the send as queued
instead of failed:

```typescript
import { ImmediateProcessingError, sendEmail } from '@xtr-dev/payload-mailing'

try {
  await sendEmail(payload, { template: { slug: 'invite' }, data: { to }, processImmediately: true })
} catch (error) {
  if (!(error instanceof ImmediateProcessingError)) throw error
  // Queued, not lost: error.email.id is in the outbox.
}
```

## Templates

Author templates in the admin (**Mailing → Email Templates**): a `slug`,
`subject`, rich-text `content`, and optional declared `variables`. Reference
data with `{{ }}`, e.g. `Hello {{ user.name }}!` or
`{{ createdAt | formatDate: "long" }}`.

- **Engines** — set `templateEngine` to `liquidjs` (default), `mustache`, or
  `simple`, or supply `templateRenderer: (tpl, vars) => string` for your own.
- **Escaping** — HTML-body variables are HTML-escaped by default (opt out with
  LiquidJS `{{ x | raw }}` / Mustache `{{{ x }}}`); subject and text are verbatim.
- **HTML vs. text values** — wrap a variable in `perPart({ html, text })` to give
  the HTML body one value and the plain-text body (and subject) another, e.g. a
  link button as markup in HTML and as `Log in: https://…` in text. The HTML
  value is still escaped unless you use `| raw` / `{{{ }}}`.
- **Links** — rich-text link URLs can hold variables, e.g. `{{siteUrl}}/account`
  or `{{resetUrl}}`. Leave out spaces inside the braces (the link field rejects
  URLs with spaces). The value is HTML-escaped but its scheme is not checked, so
  pass only trusted URLs.
- **Filters** (LiquidJS) — `formatDate` (`"short"`, `"long"` or default),
  `formatCurrency` and `capitalize`. Set `locale` (e.g. `'nl-NL'`), `currency`
  (e.g. `'EUR'`) and `timeZone` (e.g. `'Europe/Amsterdam'`) in the plugin
  config, or override per use: `{{ d | formatDate: "long", "nl-NL" }}`,
  `{{ total | formatCurrency: "EUR", "nl-NL" }}`.
- **Required variables** — mark declared variables Required and a send missing
  one is rejected *before it's queued*. Dotted names such as `user.name` are
  checked as nested paths. Opt-in; declare nothing to skip checks.

Render without sending: `renderTemplate(payload, slug, vars)` →
`{ html, text, subject }`.

## Layouts

Define reusable wrappers once and inject a template's body at `{{ content }}`:

```typescript
mailingPlugin({
  layouts: {
    branded: { html: `<html><body><main>{{ content }}</main></body></html>` },
  },
  defaultLayout: 'branded', // applied to templates that don't pick their own
})
```

Templates then get a **Layout** select (with **Use default** / **None**). Layout
variables are always HTML-escaped; `content` is injected without double-encoding.
Fully opt-in — with no layouts, templates render exactly as before.

## Jobs

The plugin registers its `process-email` task automatically. Sending (or
creating an `emails` doc) queues one job per email on the plugin's `queue`,
delayed until `scheduledAt` when set. You need a job **runner**: Payload's
`jobs.autoRun` cron for that queue, or your own `payload.jobs.run()` calls.

Emails move through `pending → processing → sent / failed`. A send error puts
the email back to `pending` and queues a new `process-email` job (on the same
queue) that runs once `retryDelay` has passed, so your job runner retries it
without extra code. After `retryAttempts` tries the email is marked `failed`.
`processEmails(payload)` sends up to 50 due `pending` emails per call (highest
priority, then oldest first, skipping emails whose last failed try is more
recent than `retryDelay`); call it from a scheduled task if you don't run a job
runner, or as a safety net. An email is only ever sent by the run that claims
it, so a retry job and `processEmails` never both send it.

To queue an email from a Payload job or workflow, register the
`schedule-email` task from the `/tasks` subpath:

```typescript
import { ScheduleEmailTask } from '@xtr-dev/payload-mailing/tasks'

export default buildConfig({ jobs: { tasks: [ScheduleEmailTask] } })

await payload.jobs.queue({ task: 'schedule-email', input: { to: 'user@example.com', templateSlug: 'welcome' } })
```

## Options

| Option | Description |
| --- | --- |
| `defaultFrom` / `defaultFromName` | Default sender for emails that don't set one. |
| `retryAttempts` | Send attempts before an email is marked `failed` (default `3`). |
| `retryDelay` | Wait (ms) after a failed send before it is retried (default `300000`). |
| `queue` | Job queue name (default `'default'`). A single `sendEmail` call can override it with its own `queue` option. |
| `templateEngine` | `'liquidjs'` \| `'mustache'` \| `'simple'`. |
| `templateRenderer` | Custom `(tpl, vars) => string \| Promise<string>`. |
| `strictTemplates` | `true` makes a template parse/render error throw a `TemplateRenderError` (so `sendEmail` rejects) instead of falling back to plain `{{ name }}` substitution. Default `false`. |
| `layouts` / `defaultLayout` | Named layout wrappers and the default one. |
| `locale` / `currency` / `timeZone` | Defaults for the `formatDate` / `formatCurrency` filters (otherwise en-US / USD / server time zone). |
| `adminPreview` | Live in-admin render preview; `true` by default. Set `false` to skip it (and the `payload generate:importmap` step). |
| `collections` | Rename (`'slug'`) or override (`{ access, fields, … }`) the emails/templates collections. |
| `beforeSend` | `(options, email) => options` hook to mutate the send just before delivery. |
| `resolveInternalLink` | `(fields) => url` for rich-text links to other documents (`fields.doc.relationTo` / `fields.doc.value`). Without it, internal links render as plain text. |
| `richTextEditor` | Custom Lexical editor config for the templates collection's `content` field, passed through as `RichTextField['editor']`. |
| `initOrder` | `'before'` (default) sets up `payload.mailing` before the host app's own `onInit` runs; `'after'` runs the host's `onInit` first. |

## API

| Export | Purpose |
| --- | --- |
| `sendEmail(payload, options)` | Queue (or immediately send) a template/direct email. |
| `renderTemplate(payload, slug, vars)` | Render `{ html, text, subject }` without sending. |
| `processEmails(payload)` | Send up to 50 due `pending` emails. |
| `retryFailedEmails(payload)` | Resend up to 20 `failed` emails that have attempts left and whose last attempt is older than `retryDelay`. |
| `getMailing(payload)` | Get the mailing context (service, config, slugs). |
| `escapeHtml(str)` / `safeUrl(url)` | Escape text for HTML / allow only http(s), mailto and relative URLs. |
| `perPart({ html, text })` | Give a variable separate HTML and plain-text values. |
| `ImmediateProcessingError` / `TemplateRenderError` | Thrown by `processImmediately` sends whose inline run failed / by `strictTemplates` render errors. |

`sendEmail<Email>(…)` is generic over your generated `Email` type for type-safe
custom fields.

## Requirements

PayloadCMS ^3.37.0 · Node.js ^18.20.2 || >=20.9.0

`@payloadcms/ui` and `react` are optional peers, used only by the admin
preview (`adminPreview`); a Payload app with the admin panel already has them.

## Contributing

Issues and PRs welcome at the [repository](https://github.com/xtr-dev/payload-mailing);
see [DEVELOPMENT.md](./DEVELOPMENT.md) for local setup. MIT licensed.
