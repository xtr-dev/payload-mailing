# @xtr-dev/payload-mailing

[![npm version](https://img.shields.io/npm/v/@xtr-dev/payload-mailing.svg)](https://www.npmjs.com/package/@xtr-dev/payload-mailing)

Template-based email for PayloadCMS 3.x — with layouts, scheduling, and job-queue
processing. No custom APIs: everything lives in Payload collections you already
know how to use.

> ⚠️ **Pre-release** (v0.x). Breaking changes may occur before v1.0.0.

## Features

- 📧 Templates with LiquidJS (default), Mustache, simple, or a custom engine
- 🧱 Reusable layouts (header/footer/branding wrappers)
- 👁️ In-admin live render preview (HTML + plain text)
- ⏰ Scheduling and automatic retries via the Payload job queue
- 🔒 Collections locked down by default — you opt in to who can access them
- 🎯 Full TypeScript support

## Installation

```bash
pnpm add @xtr-dev/payload-mailing
# npm install / yarn add also work
```

## Quick Start

Add the plugin and an [email adapter](https://payloadcms.com/docs/email/overview)
to your Payload config:

```typescript
import { buildConfig } from 'payload'
import { mailingPlugin } from '@xtr-dev/payload-mailing'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

export default buildConfig({
  email: nodemailerAdapter({
    defaultFromAddress: 'noreply@yoursite.com',
    defaultFromName: 'Your Site',
    transport: { /* your SMTP transport */ },
  }),
  plugins: [
    mailingPlugin({
      defaultFrom: 'noreply@yoursite.com',
      defaultFromName: 'Your Site',
      retryAttempts: 3,
      retryDelay: 300000, // 5 minutes
      // Required: grant access to the collections — see "Access Control" below.
      collections: {
        emails: { access: { /* ... */ } },
        templates: { access: { /* ... */ } },
      },
    }),
  ],
})
```

This registers two collections under a **Mailing** group in the admin:
`email-templates` (author templates) and `emails` (delivery + status tracking).

## Access Control

**The mailing collections deny every operation by default.** Payload's built-in
default would grant access to *any* authenticated user — in an app with
front-end/non-admin users that quietly exposes email content, recipients, and
templates. To avoid accidentally publicizing them, this plugin ships a
deny-all default and asks you to grant access explicitly.

Until you do, no one can read or manage these collections through the REST /
GraphQL API or the admin panel. (Sending still works: the plugin's own
sending, scheduling, and rendering run through Payload's Local API, which
bypasses access control.)

Grant the access your app needs via the collection overrides. Your `access`
functions are merged **on top of** the deny-all defaults, so any operation you
don't specify stays denied:

```typescript
mailingPlugin({
  collections: {
    emails: {
      access: {
        read:   ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    templates: {
      access: {
        read:   ({ req: { user } }) => Boolean(user),
        create: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
      },
    },
  },
})
```

`access` follows the standard [Payload access control](https://payloadcms.com/docs/access-control/collections)
API. The same override object also accepts custom `fields`, `admin`, `hooks`,
etc. — see [Collection Overrides](#collection-overrides).

## Sending Email

```typescript
import { sendEmail } from '@xtr-dev/payload-mailing'

// From a template
await sendEmail(payload, {
  template: { slug: 'welcome-email', variables: { firstName: 'John' } },
  data: {
    to: 'user@example.com',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // optional: send later
    priority: 1,                                        // optional: 1 = highest
  },
})

// Or with your own content (no template)
await sendEmail(payload, {
  data: { to: 'user@example.com', subject: 'Hi', html: '<h1>Hi</h1>' },
})
```

Emails are queued and processed in the background. Pass
`processImmediately: true` to send synchronously instead.

## Templates

Author templates in the admin (**Mailing → Email Templates**). Each has a
`slug`, `subject`, rich-text `content`, and optional declared `variables`.
Reference data with `{{ }}`:

```liquid
Hello {{ user.name }}!
{% if user.isPremium %}Welcome, premium member!{% endif %}
Joined {{ user.createdAt | formatDate: "long" }}
```

Render a template without sending:

```typescript
import { renderTemplate } from '@xtr-dev/payload-mailing'

const { html, text, subject } = await renderTemplate(payload, 'welcome-email', {
  user: { name: 'John', isPremium: false, createdAt: new Date() },
})
```

### Template engines

Choose the engine with `templateEngine`, or plug in your own:

| Engine       | Syntax                                          |
| ------------ | ----------------------------------------------- |
| `liquidjs`   | `{{ var }}`, `{% if %}` — **default**            |
| `mustache`   | `{{ var }}`, `{{#section}}…{{/section}}`         |
| `simple`     | plain `{{ var }}` replacement                    |
| custom       | `templateRenderer: (tpl, vars) => string`        |

### Variable escaping

Variables substituted into the **HTML body are HTML-escaped by default**, so
untrusted values can't inject markup. Opt a value back into raw HTML with the
`raw` filter in LiquidJS (`{{ trusted | raw }}`) or triple-staches in Mustache
(`{{{ trusted }}}`). The subject and plain-text body are emitted verbatim. With a
custom renderer you are responsible for your own escaping.

### Required variables

A template can mark declared variables as **Required**. Sending it without a
non-empty value for one is rejected *before the email is queued*, with an error
naming what's missing — preventing emails that go out with blank placeholders.
Fully opt-in; templates that declare nothing are unconstrained.

## Layouts

Define reusable wrappers (header, footer, branding) once and inject a template's
rendered body at the `{{ content }}` slot:

```typescript
mailingPlugin({
  layouts: {
    branded: {
      html: `<html><body><header>…</header><main>{{ content }}</main></body></html>`,
      text: `{{ content }}\n\n— Unsubscribe: {{ unsubscribeUrl }}`, // optional
    },
  },
  defaultLayout: 'branded', // applied to templates that don't pick their own
})
```

When any layout is configured, templates gain a **Layout** select in the admin
(with **Use default** and **None** options). Layouts run through the same engine
as templates. A layout's own variables are always HTML-escaped (no opt-out); the
already-escaped `content` is injected without double-encoding. Fully opt-in —
with no `layouts`/`defaultLayout`, templates render exactly as before.

## In-admin Preview

The template edit view includes a live **Preview** panel that renders the
current draft (through the selected layout) to HTML and plain text, seeded by a
**Sample variables** JSON field. Rendering uses the same server-side pipeline as
real sends. Sample variables are preview-only and never stored.

The preview ships a client component, so regenerate your import map after
installing or upgrading:

```bash
payload generate:importmap
```

Disable it with `adminPreview: false` (useful if you'd rather not regenerate the
import map); the render endpoint stays registered either way.

## Jobs & Scheduling

The plugin **registers its own processing job automatically** — there's no task
for you to add. Every email you send (via `sendEmail`, or by creating an `emails`
document) queues a job to render and deliver it in the background, honoring
`scheduledAt` for future sends and retrying failures automatically.

You just need a job **runner** so the queue gets processed. Either let Payload
run jobs on a schedule:

```typescript
export default buildConfig({
  jobs: {
    autoRun: [{ cron: '* * * * *', queue: 'default', limit: 10 }],
  },
})
```

…or drain the queue yourself (e.g. from your own cron) with `processEmails` —
each call handles up to 50 due emails, highest priority and oldest first:

```typescript
import { processEmails } from '@xtr-dev/payload-mailing'
await processEmails(payload)
```

For a one-off synchronous send that skips the queue, pass
`sendEmail(payload, { processImmediately: true, … })`.

Emails track a `status` of `pending` → `processing` → `sent` / `failed`. Monitor
them under **Mailing → Emails** or query the `emails` collection directly.

## Configuration

```typescript
mailingPlugin({
  // Sending
  defaultFrom: 'noreply@yoursite.com',
  defaultFromName: 'Your Site',
  retryAttempts: 3,
  retryDelay: 300000,          // ms between retries
  queue: 'default',            // job queue name

  // Templating
  templateEngine: 'liquidjs',  // 'liquidjs' | 'mustache' | 'simple'
  templateRenderer: async (tpl, vars) => yourEngine.render(tpl, vars),
  layouts: { /* … */ },
  defaultLayout: 'branded',

  // Admin
  adminPreview: true,          // set false to omit the preview field

  // Collections — rename and/or override (access, fields, hooks, …)
  collections: {
    emails: 'emails',          // string = rename, or an override object
    templates: 'email-templates',
  },

  // Hook: mutate the send options right before delivery
  beforeSend: async (options, email) => {
    options.headers = { 'X-Campaign-ID': email.campaignId }
    return options
  },
})
```

### Collection Overrides

Pass an object (instead of a string) for `collections.emails` /
`collections.templates` to layer any Payload collection config onto the built-in
one — `access` (see [Access Control](#access-control)), custom `fields`, `admin`,
`hooks`, and so on:

```typescript
mailingPlugin({
  collections: {
    emails: {
      access: { /* … */ },
      fields: [
        { name: 'campaignId', type: 'text', admin: { position: 'sidebar' } },
      ],
    },
  },
})
```

## API Reference

| Export                                   | Purpose                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| `sendEmail(payload, options)`            | Queue (or immediately send) a template/direct email. |
| `renderTemplate(payload, slug, vars)`    | Render `{ html, text, subject }` without sending.    |
| `processEmails(payload)`                 | Process up to 50 due-pending emails.                 |
| `retryFailedEmails(payload)`             | Re-queue failed emails.                              |
| `getMailing(payload)`                    | Get the mailing context (service, config, slugs).    |

`sendEmail` is generic over your generated `Email` type for type-safe custom
fields:

```typescript
import type { Email } from './payload-types'

await sendEmail<Email>(payload, {
  template: { slug: 'welcome', variables: { name: 'John' } },
  data: { to: 'user@example.com', campaignId: 'q1-launch' }, // custom fields typed
})
```

## Requirements

- PayloadCMS ^3.0.0
- Node.js ^18.20.2 || >=20.9.0

## Contributing

Issues and PRs welcome at the
[GitHub repository](https://github.com/xtr-dev/payload-mailing). See
[DEVELOPMENT.md](./DEVELOPMENT.md) for the local setup (zero-config in-memory
MongoDB, test interface, and admin panel).

## License

MIT
