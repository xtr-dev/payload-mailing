# Using Custom ID Types

The mailing plugin now supports both `string` and `number` ID types. By default, it works with the generic `BaseEmailDocument` interface, but you can provide your own types for full type safety.

## Usage with Your Generated Types

When you have your own generated Payload types (e.g., from `payload generate:types`), you can use them with the mailing plugin:

```typescript
import { sendEmail, BaseEmailDocument } from '@xtr-dev/payload-mailing'
import { Email } from './payload-types' // Your generated types

// Option 1: Use your specific Email type
const email = await sendEmail<Email>(payload, {
  template: {
    slug: 'welcome',
    variables: { name: 'John' }
  },
  data: {
    to: 'user@example.com',
    // All your custom fields are now type-safe
  }
})

// Option 2: Extend BaseEmailDocument for custom fields
interface MyEmail extends BaseEmailDocument {
  customField: string
  anotherField?: number
}

const customEmail = await sendEmail<MyEmail>(payload, {
  data: {
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Hello World</p>',
    customField: 'my value', // Type-safe!
  }
})
```

## ID Type Compatibility

The plugin works with both:
- **String IDs**: `id: string`
- **Number IDs**: `id: number`

Your Payload configuration determines which type is used. The plugin automatically adapts to your setup.

## Type Definitions

The base interfaces provided by the plugin:

```typescript
interface BaseEmailDocument {
  id: string | number
  template?: any
  to: string[]
  cc?: string[]
  bcc?: string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, any>
  scheduledAt?: string
  sentAt?: string
  status?: 'pending' | 'processing' | 'sent' | 'failed'
  attempts?: number
  lastAttemptAt?: string
  error?: string
  priority?: number
  createdAt?: string
  updatedAt?: string
}

interface BaseEmailTemplateDocument {
  id: string | number
  name: string
  slug: string
  subject?: string
  content?: any
  createdAt?: string
  updatedAt?: string
}
```

These provide a foundation that works with any ID type while maintaining type safety for the core email functionality.