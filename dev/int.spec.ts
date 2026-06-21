import type { Payload } from 'payload'

import config from '@payload-config'
import { sendEmail } from '@xtr-dev/payload-mailing'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { previewTemplateHandler } from '../src/endpoints/previewTemplate.js'

// import { customEndpointHandler } from '../src/endpoints/customEndpointHandler.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('should have mailing plugin initialized', async () => {
    expect(payload).toBeDefined()
    expect((payload as any).mailing).toBeDefined()
    expect((payload as any).mailing.service).toBeDefined()
    expect((payload as any).mailing.config).toBeDefined()
  })

  test('can create post with custom text field added by plugin', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: {
        addedByPlugin: 'added by plugin',
      },
    })
    expect(post.addedByPlugin).toBe('added by plugin')
  })

  test('plugin creates and seeds plugin-collection', async () => {
    expect(payload.collections['plugin-collection']).toBeDefined()

    const { docs } = await payload.find({ collection: 'plugin-collection' })

    expect(docs).toHaveLength(1)
  })

  test('creating an email queues a process-email job (kept for observability)', async () => {
    const email = await sendEmail(payload, {
      data: {
        html: '<p>Queued</p>',
        subject: 'Queued send',
        to: 'queued@test.com',
      },
    })

    // The afterChange hook queues a job through the normal queue, so it shows up
    // in the payload-jobs collection (subject to the app's deleteJobOnComplete
    // retention). It has not run yet here, so it is still present. We filter by
    // the queryable `taskSlug` and match the email in JS, since the nested
    // `input.emailId` JSON path is not filterable on every database adapter.
    const jobs = await payload.find({
      collection: 'payload-jobs',
      limit: 100,
      where: { taskSlug: { equals: 'process-email' } },
    })
    const jobForEmail = (jobs.docs as { input?: { emailId?: string } }[]).find(
      (job) => job.input?.emailId === String(email.id)
    )
    expect(jobForEmail).toBeDefined()
  })

  test('preview-template endpoint renders draft content + sample variables', async () => {
    const draftContent = {
      root: { children: [{ children: [{ text: 'Hello {{ firstName }}', type: 'text' }], type: 'paragraph' }] },
    }

    // Minimal PayloadRequest shape the handler needs (auth user, JSON body, payload).
    const req = {
      body: 'present',
      headers: new Headers({ 'Content-Length': '999', 'Content-Type': 'application/json' }),
      method: 'POST',
      payload,
      text: async () =>
        JSON.stringify({
          content: draftContent,
          subject: 'Welcome {{ firstName }}',
          variables: { firstName: 'Ada' },
        }),
      user: { id: 'tester' },
    } as unknown as Parameters<typeof previewTemplateHandler>[0]

    const response = await previewTemplateHandler(req)
    expect(response.status).toBe(200)

    const result = (await response.json()) as { html: string; subject: string; text: string }
    expect(result.subject).toBe('Welcome Ada')
    expect(result.html).toContain('Hello Ada')
    expect(result.text).toContain('Hello Ada')
  })

  test('preview-template endpoint rejects unauthenticated requests', async () => {
    const req = { method: 'POST', payload, user: null } as unknown as Parameters<typeof previewTemplateHandler>[0]
    const response = await previewTemplateHandler(req)
    expect(response.status).toBe(401)
  })

  test('sendEmail({ processImmediately: true }) processes synchronously without polling', async () => {
    const email = await sendEmail(payload, {
      data: {
        html: '<p>Immediate</p>',
        subject: 'Immediate send',
        to: 'immediate@test.com',
      },
      processImmediately: true,
    })

    expect(email.id).toBeDefined()

    // The job ran synchronously via the context handoff (no polling), so the
    // email has advanced out of the pending state by the time sendEmail returns.
    const reloaded = await payload.findByID({ collection: 'emails', id: email.id })
    expect(reloaded.status).not.toBe('pending')
  })
})
