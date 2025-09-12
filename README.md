# @xtr-dev/payload-mailing

📧 **Template-based email system with scheduling and job processing for PayloadCMS**

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

// Send immediately
const emailId = await sendEmail(payload, {
  templateId: 'welcome-email',
  to: 'user@example.com',
  variables: {
    firstName: 'John',
    welcomeUrl: 'https://yoursite.com/welcome'
  }
})

// Schedule for later
const scheduledId = await scheduleEmail(payload, {
  templateId: 'reminder-email',
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
    outbox?: string      // default: 'email-outbox'
  }
  defaultFrom?: string
  transport?: Transporter | MailingTransportConfig
  queue?: string         // default: 'default'
  retryAttempts?: number // default: 3
  retryDelay?: number    // default: 300000 (5 minutes)
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
   - **Subject**: Email subject (supports Handlebars)
   - **HTML Template**: HTML content with Handlebars syntax
   - **Text Template**: Plain text version (optional)
   - **Variables**: Define available variables

### Template Example

**Subject**: `Welcome to {{siteName}}, {{firstName}}!`

**HTML Template**:
```html
<h1>Welcome {{firstName}}!</h1>
<p>Thanks for joining {{siteName}}. We're excited to have you!</p>

{{#if isPremium}}
<p><strong>Premium Benefits:</strong></p>
<ul>
  <li>Priority support</li>
  <li>Advanced features</li>
  <li>Monthly reports</li>
</ul>
{{/if}}

<p>Your account was created on {{formatDate createdAt 'long'}}.</p>
<p>Visit your dashboard: <a href="{{dashboardUrl}}">Get Started</a></p>

<hr>
<p>Best regards,<br>The {{siteName}} Team</p>
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
  templateId: 'order-confirmation', // optional
  to: 'customer@example.com',
  cc: 'manager@example.com',        // optional
  bcc: 'archive@example.com',       // optional
  from: 'orders@yoursite.com',      // optional, uses default
  replyTo: 'support@yoursite.com',  // optional
  subject: 'Custom subject',        // required if no template
  html: '<h1>Custom HTML</h1>',     // required if no template
  text: 'Custom text version',      // optional
  variables: {                      // template variables
    orderNumber: '12345',
    customerName: 'John Doe'
  },
  priority: 1                       // optional, 1-10 (1 = highest)
})
```

### scheduleEmail(payload, options)

Schedule an email for later delivery:

```typescript
const emailId = await scheduleEmail(payload, {
  templateId: 'newsletter',
  to: ['user1@example.com', 'user2@example.com'],
  scheduledAt: new Date('2024-01-15T10:00:00Z'),
  variables: {
    month: 'January',
    highlights: ['Feature A', 'Feature B']
  }
})
```

### processOutbox(payload)

Manually process pending emails:

```typescript
await processOutbox(payload)
```

### retryFailedEmails(payload)

Manually retry failed emails:

```typescript
await retryFailedEmails(payload)
```

## Job Processing

The plugin automatically processes emails using PayloadCMS jobs:

- **Outbox Processing**: Every 5 minutes
- **Failed Email Retry**: Every 30 minutes

Ensure you have jobs configured in your Payload config:

```typescript
export default buildConfig({
  jobs: {
    // Configure your job processing
    tasks: [],
    // ... other job config
  },
})
```

## Email Status Tracking

All emails are stored in the outbox collection with these statuses:

- `pending` - Waiting to be sent
- `processing` - Currently being sent
- `sent` - Successfully delivered
- `failed` - Failed to send (will retry if attempts < retryAttempts)

## Monitoring

Check the **Mailing > Email Outbox** collection in your admin panel to:

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

## TypeScript Support

The plugin includes full TypeScript definitions. Import types as needed:

```typescript
import { 
  MailingPluginConfig, 
  SendEmailOptions, 
  EmailTemplate,
  OutboxEmail 
} from '@xtr-dev/payload-mailing'
```

## License

MIT

## Contributing

Issues and pull requests welcome at [GitHub repository](https://github.com/xtr-dev/payload-mailing)