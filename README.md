# @xtr-dev/payload-mailing

[![npm version](https://img.shields.io/npm/v/@xtr-dev/payload-mailing.svg)](https://www.npmjs.com/package/@xtr-dev/payload-mailing)

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
- Created: {{formatDate user.createdAt "long"}}
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

// Process pending emails manually
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
