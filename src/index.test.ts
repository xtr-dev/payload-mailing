import { describe, expect, it } from 'vitest'

import {
  mailingPlugin,
  mailingPluginDefault,
  sendEmail,
  sendEmailDefault,
} from './index.js'

describe('public barrel default aliases', () => {
  it('exports mailingPluginDefault as the named mailingPlugin reference', () => {
    expect(mailingPluginDefault).toBe(mailingPlugin)
  })

  it('exports sendEmailDefault as the named sendEmail reference', () => {
    expect(sendEmailDefault).toBe(sendEmail)
  })
})
