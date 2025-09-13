# @xtr-dev/payload-mailing

📧 **Template-based email system with scheduling and job processing for PayloadCMS**

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

✅ **Template System**: Create reusable email templates with LiquidJS, Mustache, or simple variables

✅ **Type Safety**: Full TypeScript support using your generated Payload types

✅ **Flexible Template Engines**: LiquidJS, Mustache, or bring your own template renderer

✅ **Email Scheduling**: Schedule emails for future delivery using Payload collections

✅ **Job Integration**: Automatic processing via PayloadCMS jobs queue

✅ **Retry Failed Sends**: Automatic retry mechanism for failed emails

✅ **Payload Native**: Uses Payload collections directly - no custom APIs to learn

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

### 2. Send emails using Payload collections

```typescript
import { renderTemplate } from '@xtr-dev/payload-mailing'

// Option 1: Using templates with variables
const { html, text, subject } = await renderTemplate(payload, 'welcome-email', {
  firstName: 'John',
  welcomeUrl: 'https://yoursite.com/welcome'
})

// Create email using Payload's collection API (full type safety!)
const email = await payload.create({
  collection: 'emails',
  data: {
    to: ['user@example.com'],
    subject,
    html,
    text,
    // Schedule for later (optional)
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    // Add any custom fields you've defined
    priority: 1,
    customField: 'your-value', // Your custom collection fields work!
  }
})

// Option 2: Direct HTML email (no template needed)
const directEmail = await payload.create({
  collection: 'emails',
  data: {
    to: ['user@example.com'],
    subject: 'Welcome!',
    html: '<h1>Welcome John!</h1><p>Thanks for joining!</p>',
    text: 'Welcome John! Thanks for joining!',
  }
})
```

## Why This Approach is Better

- ✅ **Full Type Safety**: Use your generated Payload types
- ✅ **No Learning Curve**: Just use `payload.create()` like any collection
- ✅ **Maximum Flexibility**: Add any custom fields to your email collection
- ✅ **Payload Integration**: Leverage validation, hooks, access control
- ✅ **Consistent API**: One way to create data in Payload

## Configuration

### Plugin Options

```typescript
mailingPlugin({
  // Template engine (optional)
  templateEngine: 'liquidjs',  // 'liquidjs' | 'mustache' | 'simple'

  // Custom template renderer (optional)
  templateRenderer: async (template: string, variables: Record<string, any>) => {
    return yourCustomEngine.render(template, variables)
  },

  // Email transport
  transport: {
    host: 'smtp.gmail.com',
    port: 587,
    auth: { user: '...', pass: '...' }
  },

  // Collection names (optional)
  collections: {
    templates: 'email-templates',  // default
    emails: 'emails'              // default
  },

  // Sending options
  defaultFrom: 'noreply@yoursite.com',
  defaultFromName: 'Your Site',
  retryAttempts: 3,              // default
  retryDelay: 300000,            // 5 minutes (default)

  // Advanced options
  emailWrapper: (email) => ({    // optional layout wrapper
    ...email,
    html: `<html><body>${email.html}</body></html>`
  }),
  richTextEditor: lexicalEditor(),  // optional custom editor
  onReady: async (payload) => {     // optional initialization hook
    console.log('Mailing plugin ready!')
  }
})
```

### Template Engine Options

Choose your preferred template engine:

```typescript
// LiquidJS (default) - Modern syntax with logic
mailingPlugin({
  templateEngine: 'liquidjs'  // {% if user.isPremium %}Premium!{% endif %}
})

// Mustache - Logic-less templates
mailingPlugin({
  templateEngine: 'mustache'  // {{#user.isPremium}}Premium!{{/user.isPremium}}
})

// Simple variable replacement
mailingPlugin({
  templateEngine: 'simple'    // Just {{variable}} replacement
})

// Custom template renderer
mailingPlugin({
  templateRenderer: async (template, variables) => {
    return handlebars.compile(template)(variables)  // Bring your own!
  }
})
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

### Custom HTML Layouts with Email Wrapper Hook

The `emailWrapper` hook allows you to apply consistent HTML layouts and styling to all emails sent through the plugin. This is perfect for adding company branding, headers, footers, and responsive styling.

#### Basic Email Wrapper

```typescript
mailingPlugin({
  // ... other config
  emailWrapper: (email) => {
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${email.subject}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; line-height: 1.6; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; font-size: 14px; }

          /* Responsive styles */
          @media only screen and (max-width: 600px) {
            .container { margin: 0 10px; }
            .content { padding: 20px; }
          }
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
            © 2024 My Company. All rights reserved.<br>
            <a href="#" style="color: #007bff;">Unsubscribe</a> |
            <a href="#" style="color: #007bff;">Contact Support</a>
          </div>
        </div>
      </body>
      </html>
    `

    return {
      ...email,
      html: wrappedHtml,
      text: `MY COMPANY\n\n${email.text}\n\n© 2024 My Company\nUnsubscribe: [link] | Contact Support: [link]`
    }
  }
})
```

#### Advanced Email Wrapper with Dynamic Content

```typescript
mailingPlugin({
  // ... other config
  emailWrapper: (email) => {
    // You can access email properties and customize based on content
    const isTransactional = email.subject?.includes('Receipt') || email.subject?.includes('Confirmation');
    const headerColor = isTransactional ? '#28a745' : '#007bff';
    const headerText = isTransactional ? 'Order Confirmation' : 'My Company';

    const wrappedHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${email.subject}</title>
        <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <![endif]-->
        <style>
          /* Reset styles */
          body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

          /* Base styles */
          body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #f4f4f4;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }

          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }

          .email-header {
            background: linear-gradient(135deg, ${headerColor}, ${headerColor}dd);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }

          .email-content {
            padding: 30px;
            color: #333333;
            line-height: 1.6;
          }

          .email-footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }

          .email-footer a {
            color: ${headerColor};
            text-decoration: none;
          }

          /* Responsive */
          @media only screen and (max-width: 600px) {
            .email-container {
              margin: 0 10px !important;
            }
            .email-header, .email-content {
              padding: 20px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1 style="margin: 0; font-size: 24px;">${headerText}</h1>
          </div>
          <div class="email-content">
            ${email.html}
          </div>
          <div class="email-footer">
            <p style="margin: 0 0 10px;">© ${new Date().getFullYear()} My Company. All rights reserved.</p>
            <p style="margin: 0;">
              <a href="mailto:support@mycompany.com">Contact Support</a> |
              <a href="#">Privacy Policy</a> |
              <a href="#">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Also enhance the plain text version
    const wrappedText = `
${headerText.toUpperCase()}
${'='.repeat(headerText.length)}

${email.text || email.html?.replace(/<[^>]*>/g, '')}

---
© ${new Date().getFullYear()} My Company. All rights reserved.
Contact Support: support@mycompany.com
Privacy Policy: [link]
Unsubscribe: [link]
    `.trim();

    return {
      ...email,
      html: wrappedHtml,
      text: wrappedText
    }
  }
})
```

#### External CSS and Assets

You can also reference external stylesheets and assets:

```typescript
mailingPlugin({
  emailWrapper: (email) => {
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${email.subject}</title>
        <!-- External CSS -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
          /* Your custom styles here */
        </style>
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto;">
          <img src="https://mycompany.com/email-header.png" alt="My Company" style="width: 100%; height: auto;">
          <div style="padding: 20px;">
            ${email.html}
          </div>
          <img src="https://mycompany.com/email-footer.png" alt="Footer" style="width: 100%; height: auto;">
        </div>
      </body>
      </html>
    `;

    return { ...email, html: wrappedHtml };
  }
})
```

#### Template-Specific Layouts

You can customize layouts based on email templates:

```typescript
mailingPlugin({
  emailWrapper: (email, context) => {
    // Access template information if available
    const templateSlug = context?.templateSlug;

    let layoutClass = 'default-layout';
    let headerColor = '#007bff';

    if (templateSlug === 'welcome-email') {
      layoutClass = 'welcome-layout';
      headerColor = '#28a745';
    } else if (templateSlug === 'invoice-email') {
      layoutClass = 'invoice-layout';
      headerColor = '#dc3545';
    }

    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${email.subject}</title>
        <style>
          .${layoutClass} { /* template-specific styles */ }
          .header { background-color: ${headerColor}; }
        </style>
      </head>
      <body>
        <div class="${layoutClass}">
          ${email.html}
        </div>
      </body>
      </html>
    `;

    return { ...email, html: wrappedHtml };
  }
})
```

The `emailWrapper` hook receives the email object with `html`, `text`, and `subject` properties, and should return the modified email object with your custom layout applied.

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

## Template Syntax Reference

Depending on your chosen template engine, you can use different syntax:

### LiquidJS (Default)
- Variables: `{{ user.name }}`
- Logic: `{% if user.isPremium %}Premium content{% endif %}`
- Loops: `{% for item in items %}{{ item.name }}{% endfor %}`
- Filters: `{{ amount | formatCurrency }}`, `{{ date | formatDate: "short" }}`

### Mustache
- Variables: `{{ user.name }}`
- Logic: `{{#user.isPremium}}Premium content{{/user.isPremium}}`
- Loops: `{{#items}}{{ name }}{{/items}}`
- No built-in filters (use variables with pre-formatted data)

### Simple
- Variables only: `{{ user.name }}`, `{{ amount }}`, `{{ date }}`

### Built-in Filters (LiquidJS only)
- `formatDate` - Format dates: `{{ createdAt | formatDate: "short" }}`
- `formatCurrency` - Format currency: `{{ amount | formatCurrency: "USD" }}`
- `capitalize` - Capitalize first letter: `{{ name | capitalize }}`

## Available Helper Functions

```typescript
import {
  renderTemplate,    // Render email templates with variables
  processEmails,     // Process pending emails manually
  retryFailedEmails, // Retry failed emails
  getMailing        // Get mailing service instance
} from '@xtr-dev/payload-mailing'

// Render a template
const { html, text, subject } = await renderTemplate(payload, 'welcome', {
  name: 'John',
  activationUrl: 'https://example.com/activate'
})

// Process emails manually
await processEmails(payload)

// Retry failed emails
await retryFailedEmails(payload)
```

## PayloadCMS Task Integration

The plugin provides a ready-to-use PayloadCMS task for queuing template emails:

### 1. Add the task to your Payload config

```typescript
import { buildConfig } from 'payload/config'
import { sendTemplateEmailTask } from '@xtr-dev/payload-mailing'

export default buildConfig({
  // ... your config
  jobs: {
    tasks: [
      sendTemplateEmailTask,
      // ... your other tasks
    ]
  }
})
```

### 2. Queue emails from your code

```typescript
import type { SendTemplateEmailInput } from '@xtr-dev/payload-mailing'

// Queue a template email
const result = await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    templateSlug: 'welcome-email',
    to: ['user@example.com'],
    cc: ['manager@example.com'],
    variables: {
      firstName: 'John',
      activationUrl: 'https://example.com/activate/123'
    },
    priority: 1,
    // Add any custom fields from your email collection
    customField: 'value'
  } as SendTemplateEmailInput
})

// Queue a scheduled email
await payload.jobs.queue({
  task: 'send-template-email',
  input: {
    templateSlug: 'reminder-email',
    to: ['user@example.com'],
    variables: { eventName: 'Product Launch' },
    scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
    priority: 3
  }
})
```

### 3. Use in admin panel workflows

The task can also be triggered from the Payload admin panel with a user-friendly form interface that includes:
- Template slug selection
- Email recipients (to, cc, bcc)
- Template variables as JSON
- Optional scheduling
- Priority setting
- Any custom fields you've added to your email collection

### Task Benefits

- ✅ **Easy Integration**: Just add to your tasks array
- ✅ **Type Safety**: Full TypeScript support with `SendTemplateEmailInput`
- ✅ **Admin UI**: Ready-to-use form interface
- ✅ **Flexible**: Supports all your custom email collection fields
- ✅ **Error Handling**: Comprehensive error reporting
- ✅ **Queue Management**: Leverage Payload's job queue system

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

## Migration Guide (v0.0.x → v0.1.0)

**🚨 BREAKING CHANGES**: The API has been simplified to use Payload collections directly.

### Before (v0.0.x)
```typescript
import { sendEmail, scheduleEmail } from '@xtr-dev/payload-mailing'

// Old way
const emailId = await sendEmail(payload, {
  templateSlug: 'welcome',
  to: 'user@example.com',
  variables: { name: 'John' }
})

const scheduledId = await scheduleEmail(payload, {
  templateSlug: 'reminder',
  to: 'user@example.com',
  scheduledAt: new Date('2024-01-15T10:00:00Z'),
  variables: { eventName: 'Launch' }
})
```

### After (v0.1.0+)
```typescript
import { renderTemplate } from '@xtr-dev/payload-mailing'

// New way - render template first
const { html, text, subject } = await renderTemplate(payload, 'welcome', {
  name: 'John'
})

// Then create email using Payload collections (full type safety!)
const email = await payload.create({
  collection: 'emails',
  data: {
    to: ['user@example.com'],
    subject,
    html,
    text,
    // For scheduling
    scheduledAt: new Date('2024-01-15T10:00:00Z'),
    // Add any custom fields from your collection
    customField: 'value',
  }
})
```

### Benefits of Migration
- ✅ **Full TypeScript support** with your generated Payload types
- ✅ **Use any custom fields** you add to your email collection
- ✅ **Leverage Payload's features**: validation, hooks, access control
- ✅ **One consistent API** - just use `payload.create()`
- ✅ **No wrapper methods** - direct access to Payload's power

## Recent Changes

### v0.1.0 (Latest - Breaking Changes)

**🚀 Major API Simplification:**
- **REMOVED**: `sendEmail()` and `scheduleEmail()` wrapper methods
- **REMOVED**: `SendEmailOptions` custom types
- **ADDED**: Direct Payload collection usage with full type safety
- **ADDED**: `renderTemplate()` helper for template rendering
- **ADDED**: Support for LiquidJS, Mustache, and custom template engines
- **IMPROVED**: Webpack compatibility with proper dynamic imports

**Template Engine Enhancements:**
- **NEW**: LiquidJS support (default) with modern syntax and logic
- **NEW**: Mustache support for logic-less templates
- **NEW**: Custom template renderer hook for maximum flexibility
- **NEW**: Simple variable replacement as fallback
- **FIXED**: All webpack compatibility issues resolved

**Developer Experience:**
- **IMPROVED**: Full TypeScript inference using generated Payload types
- **IMPROVED**: Comprehensive migration guide and documentation
- **IMPROVED**: Better error handling and async patterns
- **SIMPLIFIED**: Cleaner codebase with fewer abstractions

## License

MIT

## Contributing

Issues and pull requests welcome at [GitHub repository](https://github.com/xtr-dev/payload-mailing)
