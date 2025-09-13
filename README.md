# @xtr-dev/payload-mailing

📧 **Template-based email system with scheduling and job processing for PayloadCMS**

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

✅ **Template System**: Create reusable email templates with Handlebars syntax  
✅ **Outbox Scheduling**: Schedule emails for future delivery  
✅ **Job Integration**: Automatic processing via PayloadCMS jobs queue  
✅ **Retry Failed Sends**: Automatic retry mechanism for failed emails  
✅ **Template Variables**: Dynamic content with validation  
✅ **Developer API**: Simple methods for sending emails programmatically

## Installation

```bash
npm install @xtr-dev/payload-mailing
```

## Quick Start

### 1. Add the plugin to your Payload config

```typescript
import { buildConfig } from 'payload/config'
import { mailingPlugin } from '@xtr-dev/payload-mailing'

export default buildConfig({
  // ... your config
  plugins: [
    mailingPlugin({
      defaultFrom: 'noreply@yoursite.com',
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
      retryAttempts: 3,
      retryDelay: 300000, // 5 minutes
      queue: 'email-queue', // optional
    }),
  ],
})
```

### 2. Send emails in your code

```typescript
import { sendEmail, scheduleEmail } from '@xtr-dev/payload-mailing'

// Send immediately using template slug
const emailId = await sendEmail(payload, {
  templateSlug: 'welcome-email',
  to: 'user@example.com',
  variables: {
    firstName: 'John',
    welcomeUrl: 'https://yoursite.com/welcome'
  }
})

// Schedule for later
const scheduledId = await scheduleEmail(payload, {
  templateSlug: 'reminder-email',
  to: 'user@example.com',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  variables: {
    eventName: 'Product Launch',
    eventDate: new Date('2024-01-15')
  }
})
```

## Configuration

### Plugin Options

```typescript
interface MailingPluginConfig {
  collections?: {
    templates?: string    // default: 'email-templates'
    emails?: string      // default: 'emails'
  }
  defaultFrom?: string
  transport?: Transporter | MailingTransportConfig
  queue?: string         // default: 'default'
  retryAttempts?: number // default: 3
  retryDelay?: number    // default: 300000 (5 minutes)
  emailWrapper?: EmailWrapperHook // optional email layout wrapper
  richTextEditor?: RichTextField['editor'] // optional custom rich text editor
  onReady?: (payload: any) => Promise<void> // optional callback after plugin initialization
  initOrder?: 'before' | 'after' // default: 'before'
}
```

### Transport Configuration

You can provide either a Nodemailer transporter instance or configuration:

```typescript
// Using configuration object
{
  transport: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  }
}

// Or using a transporter instance
import nodemailer from 'nodemailer'
{
  transport: nodemailer.createTransporter({
    // your config
  })
}
```

## Creating Email Templates

1. Go to your Payload admin panel
2. Navigate to **Mailing > Email Templates**
3. Create a new template with:
   - **Name**: Descriptive name for the template
   - **Slug**: Unique identifier for the template (auto-generated)
   - **Subject**: Email subject (supports Handlebars)
   - **Content**: Rich text editor with Handlebars syntax (automatically generates HTML and text versions)

### Template Example

**Subject**: `Welcome to {{siteName}}, {{firstName}}!`

**Content** (using rich text editor with Handlebars):
```
# Welcome {{firstName}}! 🎉

Thanks for joining {{siteName}}. We're excited to have you!

**What you can do:**
• Create beautiful emails with rich text formatting
• Use the emailWrapper hook to add custom layouts  
• Queue and schedule emails effortlessly

Your account was created on {{formatDate createdAt "long"}}.

Best regards,
The {{siteName}} Team
```

## Advanced Features

### Email Wrapper Hook

Use the `emailWrapper` hook to apply consistent layouts to all emails:

```typescript
mailingPlugin({
  // ... other config
  emailWrapper: (email) => {
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${email.subject}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: #007bff; color: white; padding: 20px; }
          .content { padding: 30px; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>My Company</h1>
          </div>
          <div class="content">
            ${email.html}
          </div>
          <div class="footer">
            © 2024 My Company. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `

    return {
      ...email,
      html: wrappedHtml,
      text: `MY COMPANY\n\n${email.text}\n\n© 2024 My Company`
    }
  }
})
```

### Custom Rich Text Editor

Override the rich text editor used for templates:

```typescript
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { FixedToolbarFeature, HeadingFeature } from '@payloadcms/richtext-lexical'

mailingPlugin({
  // ... other config  
  richTextEditor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      FixedToolbarFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
      // Add more features as needed
    ],
  })
})
```

### Initialization Hooks

Control plugin initialization order and add post-initialization logic:

```typescript
mailingPlugin({
  // ... other config
  initOrder: 'after', // Initialize after main Payload onInit
  onReady: async (payload) => {
    // Called after plugin is fully initialized
    console.log('Mailing plugin ready!')
    
    // Custom initialization logic here
    await setupCustomEmailSettings(payload)
  }
})
```

## Handlebars Helpers

The plugin includes several built-in helpers:

- `{{formatDate date 'short'}}` - Format dates (short, long, or default)
- `{{formatCurrency amount 'USD'}}` - Format currency
- `{{capitalize string}}` - Capitalize first letter
- `{{#ifEquals value1 value2}}...{{/ifEquals}}` - Conditional equality

## API Methods

### sendEmail(payload, options)

Send an email immediately:

```typescript
const emailId = await sendEmail(payload, {
  templateSlug: 'order-confirmation', // optional - use template slug
  to: ['customer@example.com'],       // string or array of emails
  cc: ['manager@example.com'],        // optional - array of emails
  bcc: ['archive@example.com'],       // optional - array of emails  
  from: 'orders@yoursite.com',        // optional, uses default
  replyTo: 'support@yoursite.com',    // optional
  subject: 'Custom subject',          // required if no template
  html: '<h1>Custom HTML</h1>',       // required if no template
  text: 'Custom text version',        // optional
  variables: {                        // template variables
    orderNumber: '12345',
    customerName: 'John Doe'
  },
  priority: 1                         // optional, 1-10 (1 = highest)
})
```

### scheduleEmail(payload, options)

Schedule an email for later delivery:

```typescript
const emailId = await scheduleEmail(payload, {
  templateSlug: 'newsletter',
  to: ['user1@example.com', 'user2@example.com'],
  scheduledAt: new Date('2024-01-15T10:00:00Z'),
  variables: {
    month: 'January',
    highlights: ['Feature A', 'Feature B']
  }
})
```

### processEmails(payload)

Manually process pending emails:

```typescript
import { processEmails } from '@xtr-dev/payload-mailing'
await processEmails(payload)
```

### retryFailedEmails(payload)

Manually retry failed emails:

```typescript
import { retryFailedEmails } from '@xtr-dev/payload-mailing'
await retryFailedEmails(payload)
```

## Job Processing

The plugin automatically adds a unified email processing job to PayloadCMS:

- **Job Name**: `process-email-queue`
- **Function**: Processes both pending emails and retries failed emails
- **Trigger**: Manual via admin panel or API call

The job is automatically registered when the plugin initializes. To trigger it manually:

```typescript
// Queue the job for processing
await payload.jobs.queue({
  task: 'process-email-queue',
  input: {}
})
```

## Email Status Tracking

All emails are stored in the emails collection with these statuses:

- `pending` - Waiting to be sent
- `processing` - Currently being sent
- `sent` - Successfully delivered
- `failed` - Failed to send (will retry if attempts < retryAttempts)

## Monitoring

Check the **Mailing > Emails** collection in your admin panel to:

- View email delivery status
- See error messages for failed sends
- Track retry attempts
- Monitor scheduled emails

## Environment Variables

```bash
# Email configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yoursite.com
```

## Security and Access Control

### Collection Access Restrictions

By default, both email templates and emails collections allow full access (`read/create/update/delete: () => true`). For production use, you should configure proper access restrictions using collection overrides:

```typescript
mailingPlugin({
  // ... other config
  collections: {
    templates: {
      access: {
        read: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:read')
        },
        create: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:create')
        },
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:update')
        },
        delete: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin'
        },
      }
    },
    emails: {
      access: {
        read: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:read')
        },
        create: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:create')
        },
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin' || user.permissions?.includes('mailing:update')
        },
        delete: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'admin'
        },
      }
    }
  }
})
```

### Collection Overrides

You can override any collection configuration using the `collections.templates` or `collections.emails` options. This includes:

- **Access controls** - Restrict who can read/create/update/delete
- **Admin UI settings** - Customize admin interface appearance
- **Field modifications** - Add custom fields or modify existing ones
- **Hooks** - Add custom validation or processing logic

Example with additional custom fields:

```typescript
mailingPlugin({
  // ... other config
  collections: {
    templates: {
      admin: {
        group: 'Custom Marketing',
        description: 'Custom email templates with enhanced features'
      },
      fields: [
        // Plugin's default fields are preserved
        {
          name: 'category',
          type: 'select',
          options: [
            { label: 'Marketing', value: 'marketing' },
            { label: 'Transactional', value: 'transactional' },
            { label: 'System', value: 'system' }
          ],
          admin: {
            position: 'sidebar'
          }
        },
        {
          name: 'tags',
          type: 'text',
          hasMany: true,
          admin: {
            description: 'Tags for organizing templates'
          }
        }
      ],
      hooks: {
        beforeChange: [
          ({ data, req }) => {
            // Custom validation logic
            if (data.category === 'system' && req.user?.role !== 'admin') {
              throw new Error('Only admins can create system templates')
            }
            return data
          }
        ]
      }
    }
  }
})
```

## TypeScript Support

The plugin includes full TypeScript definitions. Import types as needed:

```typescript
import {
  MailingPluginConfig,
  SendEmailOptions,
  EmailTemplate,
  QueuedEmail,
  EmailObject,
  EmailWrapperHook
} from '@xtr-dev/payload-mailing'
```

## Recent Changes

### v0.0.x (Latest)

**🔄 Breaking Changes:**
- Removed email layouts system in favor of `emailWrapper` hook for better flexibility
- Email fields (`to`, `cc`, `bcc`) now use `hasMany: true` for proper array handling  
- Templates now use slug-based lookup instead of ID-based for developer-friendly API
- Email collection renamed from "outbox" to "emails"
- Unified job processing: single `process-email-queue` job handles both pending and failed emails

**✨ New Features:**
- Rich text editor with automatic HTML/text conversion
- Template slugs for easier template reference
- `emailWrapper` hook for consistent email layouts
- Custom rich text editor configuration support
- Initialization hooks (`onReady`, `initOrder`) for better plugin lifecycle control
- Improved Handlebars variable interpolation with defensive programming

**🐛 Bug Fixes:**
- Fixed text version uppercase conversion in headings
- Fixed Handlebars interpolation issues in text version
- Improved plugin initialization order to prevent timing issues

**💡 Improvements:**
- Better admin UI with proper array input controls
- More robust error handling and logging
- Enhanced TypeScript definitions
- Simplified template creation workflow

## License

MIT

## Contributing

Issues and pull requests welcome at [GitHub repository](https://github.com/xtr-dev/payload-mailing)
