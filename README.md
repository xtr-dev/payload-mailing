# @xtr-dev/payload-mailing

A template-based email system with scheduling and job processing for PayloadCMS 3.x.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Template-based emails with LiquidJS, Mustache, or custom engines
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

## Templates

Use `{{}}` to insert data in templates:

- `{{user.name}}` - User data from variables
- `{{formatDate createdAt "short"}}` - Built-in date formatting
- `{{formatCurrency amount "USD"}}` - Currency formatting

Example template:
```liquid
Subject: Welcome {{user.name}}!

{% if user.isPremium %}
Welcome Premium Member {{user.name}}!

Your premium features are ready.
{% else %}
Welcome {{user.name}}!

Upgrade to premium for more features.
{% endif %}

Account created: {{formatDate user.createdAt "long"}}
```

## Requirements

- PayloadCMS ^3.45.0
- Node.js ^18.20.2 || >=20.9.0
- pnpm ^9 || ^10

## Job Processing

Queue emails using PayloadCMS jobs:

```typescript
import { sendTemplateEmailTask } from '@xtr-dev/payload-mailing'

// Add to your Payload config
export default buildConfig({
  jobs: {
    tasks: [sendTemplateEmailTask]
  }
})

// Queue a template email
await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    templateSlug: 'welcome-email',
    to: ['user@example.com'],
    variables: { firstName: 'John' },
    scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString()
  }
})
```

## Email Status

Emails are tracked with these statuses:
- `pending` - Waiting to be sent
- `processing` - Currently being sent
- `sent` - Successfully delivered
- `failed` - Failed to send (will retry automatically)

## Environment Variables

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yoursite.com
```

## License

MIT

## Contributing

Issues and pull requests welcome at [GitHub repository](https://github.com/xtr-dev/payload-mailing)
