import { describe, expectTypeOf, test } from 'vitest'

import type { SendEmailOptions } from './sendEmail.js'
import type { BaseEmailDocument } from './types/index.js'

interface CustomEmailDocument extends BaseEmailDocument {
  customField: string
}

describe('SendEmailOptions recipient inputs', () => {
  test('accepts scalar recipient strings', () => {
    const options = {
      data: {
        bcc: 'audit@example.com',
        cc: 'manager@example.com',
        customField: 'custom value',
        to: 'user@example.com',
      },
    } satisfies SendEmailOptions<CustomEmailDocument>

    expectTypeOf(options).toMatchTypeOf<SendEmailOptions<CustomEmailDocument>>()
  })

  test('accepts recipient arrays', () => {
    const options = {
      data: {
        bcc: ['audit@example.com'],
        cc: ['manager@example.com'],
        customField: 'custom value',
        to: ['user@example.com'],
      },
    } satisfies SendEmailOptions<CustomEmailDocument>

    expectTypeOf(options).toMatchTypeOf<SendEmailOptions<CustomEmailDocument>>()
  })
})
