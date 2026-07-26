# @xtr-dev/payload-mailing

[![npm version](https://img.shields.io/npm/v/@xtr-dev/payload-mailing.svg)](https://www.npmjs.com/package/@xtr-dev/payload-mailing)

Template-based email for PayloadCMS 3.x — templates, layouts, scheduling, and
job-queue processing, all through Payload collections you already know.

> ⚠️ **Pre-release** (v0.x). Breaking changes may occur before v1.0.0.

## Install

```bash
pnpm add @xtr-dev/payload-mailing
```

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
        emails: { access: { read: ({ req: { user } }) => Boolean(user) } },
        templates: { access: { read: ({ req: { user } }) => Boolean(user) } },
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
        create: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    // templates: { access: { … } }
  },
})
```

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
`processImmediately: true` to send synchronously.

## Templates

Author templates in the admin (**Mailing → Email Templates**): a `slug`,
`subject`, rich-text `content`, and optional declared `variables`. Reference
data with `{{ }}`, e.g. `Hello {{ user.name }}!` or
`{{ createdAt | formatDate: "long" }}`.

- **Engines** — set `templateEngine` to `liquidjs` (default), `mustache`, or
  `simple`, or supply `templateRenderer: (tpl, vars) => string` for your own.
- **Escaping** — HTML-body variables are HTML-escaped by default (opt out with
  LiquidJS `{{ x | raw }}` / Mustache `{{{ x }}}`); subject and text are verbatim.
- **Required variables** — mark declared variables Required and a send missing
  one is rejected *before it's queued*. Opt-in; declare nothing to skip checks.

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

The plugin registers its processing job automatically — nothing to add. Sending
(or creating an `emails` doc) queues a background job that honors `scheduledAt`
and retries failures. You just need a job **runner**: either Payload's
`jobs.autoRun` cron, or call `processEmails(payload)` yourself (drains up to 50
due emails per call, highest priority first). Emails track a `status` of
`pending → processing → sent / failed`.

## Options

| Option | Description |
| --- | --- |
| `defaultFrom` / `defaultFromName` | Default sender for emails that don't set one. |
| `retryAttempts` / `retryDelay` | Retry count and delay (ms) for failed sends. |
| `queue` | Job queue name (default `'default'`). |
| `templateEngine` | `'liquidjs'` \| `'mustache'` \| `'simple'`. |
| `templateRenderer` | Custom `(tpl, vars) => string \| Promise<string>`. |
| `layouts` / `defaultLayout` | Named layout wrappers and the default one. |
| `adminPreview` | Live in-admin render preview; `true` by default. Set `false` to skip it (and the `payload generate:importmap` step). |
| `collections` | Rename (`'slug'`) or override (`{ access, fields, … }`) the emails/templates collections. |
| `beforeSend` | `(options, email) => options` hook to mutate the send just before delivery. |

## API

| Export | Purpose |
| --- | --- |
| `sendEmail(payload, options)` | Queue (or immediately send) a template/direct email. |
| `renderTemplate(payload, slug, vars)` | Render `{ html, text, subject }` without sending. |
| `processEmails(payload)` | Process up to 50 due-pending emails. |
| `retryFailedEmails(payload)` | Re-queue failed emails. |
| `getMailing(payload)` | Get the mailing context (service, config, slugs). |

`sendEmail<Email>(…)` is generic over your generated `Email` type for type-safe
custom fields.

## Requirements

PayloadCMS ^3.0.0 · Node.js ^18.20.2 || >=20.9.0

## Contributing

Issues and PRs welcome at the [repository](https://github.com/xtr-dev/payload-mailing);
see [DEVELOPMENT.md](./DEVELOPMENT.md) for local setup. MIT licensed.
