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

## Compatibility

The plugin works with:
- **String IDs**: `id: string`
- **Number IDs**: `id: number`
- **Nullable fields**: Fields can be `null`, `undefined`, or have values
- **Date fields**: Timestamp fields support both `Date` objects and `string` (ISO) formats
- **JSON variables**: Variables field supports any JSON-compatible value type
- **Generated types**: Works with `payload generate:types` output

Your Payload configuration determines which types are used. The plugin automatically adapts to your setup.

## Type Definitions

The base interfaces provided by the plugin:

```typescript
// JSON value type that matches Payload's JSON field type
type JSONValue = string | number | boolean | { [k: string]: unknown } | unknown[] | null | undefined

interface BaseEmailDocument {
  id: string | number
  template?: any
  to: string[]
  cc?: string[] | null
  bcc?: string[] | null
  from?: string | null
  replyTo?: string | null
  subject: string
  html: string
  text?: string | null
  variables?: JSONValue  // Supports any JSON-compatible value
  scheduledAt?: string | Date | null
  sentAt?: string | Date | null
  status?: 'pending' | 'processing' | 'sent' | 'failed' | null
  attempts?: number | null
  lastAttemptAt?: string | Date | null
  error?: string | null
  priority?: number | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

interface BaseEmailTemplateDocument {
  id: string | number
  name: string
  slug: string
  subject?: string | null
  content?: any
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}
```

These provide a foundation that works with any ID type while maintaining type safety for the core email functionality.