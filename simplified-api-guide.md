# Simplified API Guide

The mailing plugin now uses a much simpler, type-safe API that leverages PayloadCMS's existing collection system instead of custom email methods.

## New API Approach

### ✅ **Recommended: Use Payload Collections Directly**

```typescript
import { payload, renderTemplate } from '@xtr-dev/payload-mailing'

// 1. Render a template (optional)
const rendered = await renderTemplate(payload, 'welcome-email', {
  name: 'John Doe',
  activationLink: 'https://example.com/activate/123'
})

// 2. Create an email using Payload's collection API
const email = await payload.create({
  collection: 'emails', // Your email collection name
  data: {
    to: ['user@example.com'],
    subject: rendered.subject, // or your own subject
    html: rendered.html,       // or your own HTML
    text: rendered.text,       // or your own text
    // Add any custom fields you've defined in your collection
    priority: 1,
    scheduledAt: new Date('2024-01-01T10:00:00Z'), // Optional scheduling
  }
})
```

### ❌ **Old API (Removed)**

```typescript
// These methods have been removed to simplify the API
await sendEmail(payload, { to: '...', subject: '...' })
await scheduleEmail(payload, { to: '...', scheduledAt: new Date() })
```

## Benefits of the New Approach

### 🎯 **Type Safety**
- Full TypeScript support using your generated Payload types
- IntelliSense for all your custom collection fields
- Compile-time validation of email data

### 🚀 **Flexibility**
- Use any fields you've added to your email collection
- Leverage Payload's built-in validation, hooks, and access control
- Full control over email data structure

### 🧹 **Simplicity**
- One consistent API (Payload collections) instead of custom methods
- No duplicate type definitions
- Less code to maintain

## Usage Examples

### Basic Email with Template
```typescript
import { renderTemplate } from '@xtr-dev/payload-mailing'

const { html, text, subject } = await renderTemplate(payload, 'order-confirmation', {
  orderNumber: '#12345',
  customerName: 'Jane Smith',
  items: [
    { name: 'Product 1', price: 29.99 },
    { name: 'Product 2', price: 49.99 }
  ]
})

await payload.create({
  collection: 'emails',
  data: {
    to: ['customer@example.com'],
    subject,
    html,
    text,
    priority: 2,
    // Add your custom fields
    orderId: '12345',
    customerSegment: 'premium'
  }
})
```

### Bulk Email Creation
```typescript
const customers = await payload.find({
  collection: 'customers',
  where: { newsletter: { equals: true } }
})

for (const customer of customers.docs) {
  const { html, text, subject } = await renderTemplate(payload, 'newsletter', {
    name: customer.name,
    unsubscribeLink: `https://example.com/unsubscribe/${customer.id}`
  })

  await payload.create({
    collection: 'emails',
    data: {
      to: [customer.email],
      subject,
      html,
      text,
      scheduledAt: new Date('2024-01-15T09:00:00Z'), // Send next week
    }
  })
}
```

### Direct HTML Email (No Template)
```typescript
await payload.create({
  collection: 'emails',
  data: {
    to: ['admin@example.com'],
    subject: 'System Alert',
    html: '<h1>Server Error</h1><p>Please check the logs immediately.</p>',
    text: 'Server Error: Please check the logs immediately.',
    priority: 10, // High priority
  }
})
```

## Available Helper Functions

```typescript
import {
  renderTemplate,    // Render email templates with variables
  processEmails,     // Process pending emails manually
  retryFailedEmails, // Retry failed emails
  getMailing        // Get mailing service instance
} from '@xtr-dev/payload-mailing'
```

## Migration Guide

If you were using the old `sendEmail`/`scheduleEmail` methods, update your code:

**Before:**
```typescript
await sendEmail(payload, {
  templateSlug: 'welcome',
  to: 'user@example.com',
  variables: { name: 'John' }
})
```

**After:**
```typescript
const { html, text, subject } = await renderTemplate(payload, 'welcome', { name: 'John' })

await payload.create({
  collection: 'emails',
  data: {
    to: ['user@example.com'],
    subject,
    html,
    text
  }
})
```

This new approach gives you the full power and type safety of PayloadCMS while keeping the mailing functionality simple and consistent! 🚀