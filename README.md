# @xtr-dev/payload-mailing

[![npm version](https://img.shields.io/npm/v/@xtr-dev/payload-mailing.svg)](https://www.npmjs.com/package/@xtr-dev/payload-mailing)

A template-based email system with scheduling and job processing for PayloadCMS 3.x.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Template-based emails with LiquidJS, Mustache, or custom engines
- 🧱 Reusable email layouts (header/footer/branding wrappers)
- 👁️ In-admin live render preview (HTML + plain text) with sample variables
- ⏰ Email scheduling for future delivery
- 🔄 Automatic retry mechanism for failed sends
- 🎯 Full TypeScript support with generated Payload types
- 📋 Job queue integration via PayloadCMS
- 🔧 Uses Payload collections directly - no custom APIs

## Installation

```bash
npm install @xtr-dev/payload-mailing
# or
pnpm add @xtr-dev/payload-mailing
# or
yarn add @xtr-dev/payload-mailing
```

## Quick Start

```typescript
import { buildConfig } from 'payload'
import { mailingPlugin } from '@xtr-dev/payload-mailing'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

export default buildConfig({
  // ... your config
  email: nodemailerAdapter({
    defaultFromAddress: 'noreply@yoursite.com',
    defaultFromName: 'Your Site',
    transport: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    },
  }),
  plugins: [
    mailingPlugin({
      defaultFrom: 'noreply@yoursite.com',
      defaultFromName: 'Your Site Name',
      retryAttempts: 3,
      retryDelay: 300000, // 5 minutes
    }),
  ],
})
```

## Imports

```typescript
// Main plugin
import { mailingPlugin } from '@xtr-dev/payload-mailing'

// Helper functions
import { sendEmail, renderTemplate, processEmails } from '@xtr-dev/payload-mailing'

// Job tasks
import { sendTemplateEmailTask } from '@xtr-dev/payload-mailing'

// Types
import type { MailingPluginConfig, SendEmailOptions } from '@xtr-dev/payload-mailing'
```

## Usage

```typescript
import { sendEmail } from '@xtr-dev/payload-mailing'

// Using templates
const email = await sendEmail(payload, {
  template: {
    slug: 'welcome-email',
    variables: { firstName: 'John', welcomeUrl: 'https://example.com' }
  },
  data: {
    to: 'user@example.com',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Schedule for later
    priority: 1
  }
})

// Direct email
const directEmail = await payload.create({
  collection: 'emails',
  data: {
    to: ['user@example.com'],
    subject: 'Welcome!',
    html: '<h1>Welcome!</h1>',
    text: 'Welcome!'
  }
})
```

## Template Engines

### LiquidJS (Default)
Modern template syntax with logic support:
```liquid
{% if user.isPremium %}
  Welcome Premium Member {{user.name}}!
{% else %}
  Welcome {{user.name}}!
{% endif %}
```

### Mustache
Logic-less templates:
```mustache
{{#user.isPremium}}
  Welcome Premium Member {{user.name}}!
{{/user.isPremium}}
{{^user.isPremium}}
  Welcome {{user.name}}!
{{/user.isPremium}}
```

### Simple Variables
Basic `{{variable}}` replacement:
```text
Welcome {{user.name}}! Your account expires on {{expireDate}}.
```

### Custom Renderer
Bring your own template engine:
```typescript
mailingPlugin({
  templateRenderer: async (template, variables) => {
    return handlebars.compile(template)(variables)
  }
})
```

### Variable escaping & untrusted data

Rich-text content is HTML-escaped during serialization, and template
**variables substituted into the HTML body are HTML-escaped by default** so that
untrusted values (names, user input, etc.) cannot inject markup or scripts into
the email. This applies to the built-in engines:

- **LiquidJS** (default) and **Simple** — HTML-body variables are auto-escaped.
  In LiquidJS, opt a specific variable back into raw HTML with the `raw` filter:
  `{{ trustedHtml | raw }}`.
- **Mustache** — already escapes `{{ var }}` by default; use `{{{ var }}}` for raw.
- **Custom renderer** — you are responsible for escaping your own output.

Escaping is applied to the **HTML body only**. The plain-text body and the
subject line keep variable values verbatim, so characters like `&` are not
turned into entities for recipients.

## Layouts

Layouts let you define a reusable wrapper (header, footer, branding, container
table, etc.) once and apply it to many templates. The rendered template body is
injected into the layout at a `{{ content }}` slot, producing the final HTML and
plain text.

### Configuring layouts

Layouts are declared as a **config map** of named layouts in the plugin options.
Keeping them in code means they are versioned with your application, require no
new collection or database migration, and carry the lowest risk:

```typescript
mailingPlugin({
  // ...
  layouts: {
    branded: {
      html: `<!DOCTYPE html>
<html>
  <body style="font-family: sans-serif;">
    <header><img src="https://example.com/logo.png" alt="{{ siteName }}"></header>
    <main>{{ content }}</main>
    <footer>© {{ siteName }} — <a href="{{ unsubscribeUrl }}">Unsubscribe</a></footer>
  </body>
</html>`,
      text: `{{ siteName }}
------------------------------

{{ content }}

------------------------------
Unsubscribe: {{ unsubscribeUrl }}`,
    },
  },
  // Applied to templates that do not pick their own layout:
  defaultLayout: 'branded',
})
```

### The `{{ content }}` slot

Each layout must contain a `{{ content }}` slot where the rendered body is
injected. Layout strings run through the **same template engine** as templates,
so they can use the same variables and filters. The plugin renders the layout
with all of your template variables plus a `content` variable equal to the
already-rendered body.

- The **HTML** layout wraps the HTML body via its `{{ content }}` slot.
- The optional **`text`** layout wraps the plain-text body via its own
  `{{ content }}` slot, keeping the text/MIME alternative correct. If a layout
  omits `text`, the plain-text body is sent **unwrapped** (current behavior).

#### Escaping in layouts

The plugin keeps the same escaping guarantees inside layouts as it does in
template bodies, regardless of which engine you use:

- **`content` is injected verbatim.** The body was already escaped during its
  own render pass, so it is never escaped again — no double-encoding.
- **A layout's own variables (e.g. `{{ siteName }}`) are HTML-escaped** in the
  HTML layout, so untrusted values surfaced in a header or footer cannot inject
  markup. The plain-text layout emits them verbatim. Opt a variable back into
  raw HTML the same way you would in a body: `{{ name | raw }}` (LiquidJS) or
  `{{{ name }}}` (Mustache).
- **Mustache** users may write the slot as either `{{ content }}` or
  `{{{ content }}}` — both inject the body raw. (Mustache normally escapes
  `{{ }}` output; the plugin handles the `content` slot so it is never
  double-escaped either way.)

### Selecting a layout per template

When one or more layouts are configured, templates gain a **Layout** select
field in the admin UI. The options are derived from your configured layout names
plus:

- **Use default** — defers to the plugin's `defaultLayout` (this is the default).
- **None** — explicitly sends the body without any layout, even when a
  `defaultLayout` is configured.

### Back-compat

Layouts are fully opt-in. If you configure no `layouts` and no `defaultLayout`,
nothing changes: the **Layout** field is not added to the collection and every
template renders **exactly as before**. A template set to **None** also renders
unwrapped.

> **Roadmap:** A collection-based layout source (editor-managed layouts) may be
> offered in a future release as an alternative to the config map.

## In-admin render preview

The templates collection includes a live **Preview** panel in the edit view that
renders the current (unsaved) template and shows both outputs side by side:

- the **HTML** output, in a sandboxed `iframe` (scripts disabled, so preview
  content can never execute), and
- the **plain-text** output, in a monospace panel.

A **Sample variables** JSON field seeds the preview — e.g. `{ "firstName": "Ada" }`.
Edit the content, subject, sample variables, or selected layout and the preview
re-renders (debounced). Rendering goes through the same server-side pipeline used
to send real emails (`POST <api>/mailing/preview-template`), so the preview honors
the configured **template engine** and the selected **layout** rather than
reimplementing serialization in the browser. The `sampleVariables` field is used
only for previewing — it is never stored on sent emails.

### Registering the client component

The preview ships a client component (`@xtr-dev/payload-mailing/client#TemplatePreview`),
so after adding or upgrading the plugin you must regenerate your import map:

```bash
payload generate:importmap
```

### Disabling the preview

The preview is enabled by default. To omit the preview field and its client
component (for example, if you prefer not to regenerate the import map), set:

```typescript
mailingPlugin({
  adminPreview: false,
})
```

The preview render endpoint is always registered; only the admin field and its
component are gated by this option.

## Templates

Use `{{}}` to insert data in templates:

- `{{user.name}}` - User data from variables
- `{{ createdAt | formatDate: "short" }}` - Built-in date formatting
- `{{ amount | formatCurrency: "USD" }}` - Currency formatting

### Template Structure

Templates include both subject and body content:

```liquid
<!-- Subject Template -->
Welcome {{user.name}} to {{siteName}}!

<!-- Body Template -->
# Hello {{user.name}}! 👋

{% if user.isPremium %}
**Welcome Premium Member!**

Your premium features are now active:
- Priority support
- Advanced analytics
- Custom integrations
{% else %}
Welcome to {{siteName}}!

**Ready to get started?**
- Complete your profile
- Explore our features
- [Upgrade to Premium]({{upgradeUrl}})
{% endif %}

---
**Account Details:**
- Created: {{ user.createdAt | formatDate: "long" }}
- Email: {{user.email}}
- Plan: {{user.plan | capitalize}}

Need help? Reply to this email or visit our [help center]({{helpUrl}}).

Best regards,
The {{siteName}} Team
```

### Example Usage

```typescript
// Create template in admin panel, then use:
const { html, text, subject } = await renderTemplate(payload, 'welcome-email', {
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    isPremium: false,
    plan: 'free',
    createdAt: new Date()
  },
  siteName: 'MyApp',
  upgradeUrl: 'https://myapp.com/upgrade',
  helpUrl: 'https://myapp.com/help'
})

// Results in:
// subject: "Welcome John Doe to MyApp!"
// html: "<h1>Hello John Doe! 👋</h1><p>Welcome to MyApp!</p>..."
// text: "Hello John Doe! Welcome to MyApp! Ready to get started?..."
```

## Configuration

### Plugin Options

```typescript
mailingPlugin({
  // Template engine
  templateEngine: 'liquidjs',  // 'liquidjs' | 'mustache' | 'simple'

  // Custom template renderer
  templateRenderer: async (template: string, variables: Record<string, any>) => {
    return yourCustomEngine.render(template, variables)
  },

  // Email settings
  defaultFrom: 'noreply@yoursite.com',
  defaultFromName: 'Your Site',
  retryAttempts: 3,              // Number of retry attempts
  retryDelay: 300000,            // 5 minutes between retries

  // Collection customization
  collections: {
    templates: 'email-templates', // Custom collection name
    emails: 'emails'             // Custom collection name
  },

  // Hooks
  beforeSend: async (options, email) => {
    // Modify email before sending
    options.headers = { 'X-Campaign-ID': email.campaignId }
    return options
  },

  onReady: async (payload) => {
    // Plugin initialization complete
    console.log('Mailing plugin ready!')
  }
})
```

### Collection Overrides

Customize collections with access controls and custom fields:

```typescript
mailingPlugin({
  collections: {
    emails: {
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => !!user,
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin'
      },
      fields: [
        {
          name: 'campaignId',
          type: 'text',
          admin: { position: 'sidebar' }
        }
      ]
    }
  }
})
```

## Requirements

- PayloadCMS ^3.0.0
- Node.js ^18.20.2 || >=20.9.0
- pnpm ^9 || ^10

## Job Processing

### When to Use Jobs vs Direct Sending

**Use Jobs for:**
- Bulk email campaigns (performance)
- Scheduled emails (future delivery)
- Background processing (non-blocking)
- Retry handling (automatic retries)
- High-volume sending (queue management)

**Use Direct Sending for:**
- Immediate transactional emails
- Single recipient emails
- Simple use cases
- When you need immediate feedback

### Setup

```typescript
import { sendTemplateEmailTask } from '@xtr-dev/payload-mailing'

export default buildConfig({
  jobs: {
    tasks: [sendTemplateEmailTask]
  }
})
```

### Queue Template Emails

```typescript
// Basic template email
await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    templateSlug: 'welcome-email',
    to: ['user@example.com'],
    variables: { firstName: 'John' }
  }
})

// Scheduled email
await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    templateSlug: 'reminder-email',
    to: ['user@example.com'],
    variables: { eventName: 'Product Launch' },
    scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
    priority: 1
  }
})

// Immediate processing (bypasses queue)
await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    processImmediately: true,
    templateSlug: 'urgent-notification',
    to: ['admin@example.com'],
    variables: { alertMessage: 'System critical error' }
  }
})
```

### Bulk Operations

```typescript
// Send to multiple recipients efficiently
const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com']

for (const email of recipients) {
  await payload.jobs.queue({
    task: 'send-template-email',
    input: {
      templateSlug: 'newsletter',
      to: [email],
      variables: { unsubscribeUrl: `https://example.com/unsubscribe/${email}` },
      priority: 3 // Lower priority for bulk emails
    }
  })
}
```

## Email Status & Monitoring

### Status Types

Emails are tracked with these statuses:
- `pending` - Waiting to be sent
- `processing` - Currently being sent
- `sent` - Successfully delivered
- `failed` - Failed to send (will retry automatically)

### Query Email Status

```typescript
// Check specific email status
const email = await payload.findByID({
  collection: 'emails',
  id: 'email-id'
})
console.log(`Email status: ${email.status}`)

// Find emails by status
const pendingEmails = await payload.find({
  collection: 'emails',
  where: {
    status: { equals: 'pending' }
  },
  sort: 'createdAt'
})

// Find failed emails for retry
const failedEmails = await payload.find({
  collection: 'emails',
  where: {
    status: { equals: 'failed' },
    attemptCount: { less_than: 3 }
  }
})

// Monitor scheduled emails
const scheduledEmails = await payload.find({
  collection: 'emails',
  where: {
    scheduledAt: { greater_than: new Date() },
    status: { equals: 'pending' }
  }
})
```

### Admin Panel Monitoring

Navigate to **Mailing > Emails** in your Payload admin to:
- View email delivery status and timestamps
- See error messages for failed deliveries
- Track retry attempts and next retry times
- Monitor scheduled email queue
- Filter by status, recipient, or date range
- Export email reports for analysis

## Environment Variables

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yoursite.com
```

## API Reference

### `sendEmail<T>(payload, options)`

Send emails with full type safety using your generated Payload types.

```typescript
import { sendEmail } from '@xtr-dev/payload-mailing'
import type { Email } from './payload-types'

const email = await sendEmail<Email>(payload, {
  template?: {
    slug: string                    // Template slug
    variables: Record<string, any>  // Template variables
  },
  data: {
    to: string | string[]          // Recipients
    cc?: string | string[]         // CC recipients
    bcc?: string | string[]        // BCC recipients
    subject?: string               // Email subject (overrides template)
    html?: string                  // HTML content (overrides template)
    text?: string                  // Text content (overrides template)
    scheduledAt?: Date             // Schedule for later
    priority?: number              // Priority (1-5, 1 = highest)
    // ... your custom fields from Email collection
  },
  collectionSlug?: string          // Custom collection name (default: 'emails')
})
```

### `renderTemplate(payload, slug, variables)`

Render a template without sending an email.

```typescript
import { renderTemplate } from '@xtr-dev/payload-mailing'

const result = await renderTemplate(
  payload: Payload,
  slug: string,
  variables: Record<string, any>
): Promise<{
  html: string    // Rendered HTML content
  text: string    // Rendered text content
  subject: string // Rendered subject line
}>
```

### Helper Functions

```typescript
import { processEmails, retryFailedEmails, getMailing } from '@xtr-dev/payload-mailing'

// Process pending emails manually.
// Each call handles at most 50 due-pending emails (highest priority, oldest
// first). A larger backlog is drained across successive calls, so schedule this
// to run repeatedly (e.g. via a cron job) to keep a large queue moving.
await processEmails(payload: Payload): Promise<void>

// Retry failed emails manually
await retryFailedEmails(payload: Payload): Promise<void>

// Get mailing service instance
const mailing = getMailing(payload: Payload): MailingService
```

### Job Task Types

```typescript
import type { SendTemplateEmailInput } from '@xtr-dev/payload-mailing'

interface SendTemplateEmailInput {
  templateSlug: string              // Template to use
  to: string[]                      // Recipients
  cc?: string[]                     // CC recipients
  bcc?: string[]                    // BCC recipients
  variables: Record<string, any>    // Template variables
  scheduledAt?: string              // ISO date string for scheduling
  priority?: number                 // Priority (1-5)
  processImmediately?: boolean      // Send immediately (default: false)
  [key: string]: any               // Your custom email collection fields
}
```

## Troubleshooting

### Common Issues

#### Templates not rendering
```typescript
// Check template exists
const template = await payload.findByID({
  collection: 'email-templates',
  id: 'your-template-slug'
})

// Verify template engine configuration
mailingPlugin({
  templateEngine: 'liquidjs', // Ensure correct engine
})
```

#### Emails stuck in pending status
```typescript
// Manually process email queue
import { processEmails } from '@xtr-dev/payload-mailing'
await processEmails(payload)

// Check for processing errors
const pendingEmails = await payload.find({
  collection: 'emails',
  where: { status: { equals: 'pending' } }
})
```

#### SMTP connection errors
```bash
# Verify environment variables
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password  # Use app password, not regular password

# Test connection
curl -v telnet://smtp.gmail.com:587
```

#### Template variables not working
```typescript
// Ensure variables match template syntax
const variables = {
  user: { name: 'John' },  // For {{user.name}}
  welcomeUrl: 'https://...' // For {{welcomeUrl}}
}

// Check for typos in template
{% if user.isPremium %}  <!-- Correct -->
{% if user.isPremimum %} <!-- Typo - won't work -->
```

### Error Handling

```typescript
try {
  const email = await sendEmail(payload, {
    template: { slug: 'welcome', variables: { name: 'John' } },
    data: { to: 'user@example.com' }
  })
} catch (error) {
  if (error.message.includes('Template not found')) {
    // Handle missing template
    console.error('Template does not exist:', error.templateSlug)
  } else if (error.message.includes('SMTP')) {
    // Handle email delivery issues
    console.error('Email delivery failed:', error.details)
  } else {
    // Handle other errors
    console.error('Unexpected error:', error)
  }
}
```

### Debug Mode

Enable detailed logging:

```bash
# Set environment variable
PAYLOAD_AUTOMATION_LOG_LEVEL=debug npm run dev

# Or in your code
mailingPlugin({
  onReady: async (payload) => {
    console.log('Mailing plugin initialized')
  },
  beforeSend: async (options, email) => {
    console.log('Sending email:', { to: options.to, subject: options.subject })
    return options
  }
})
```

## License

MIT

## Contributing

### Development Setup

```bash
# Clone the repository
git clone https://github.com/xtr-dev/payload-mailing.git
cd payload-mailing

# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Link for local development
pnpm link --global
```

### Testing

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Test with different PayloadCMS versions
pnpm test:payload-3.0
pnpm test:payload-latest
```

Issues and pull requests welcome at [GitHub repository](https://github.com/xtr-dev/payload-mailing)
