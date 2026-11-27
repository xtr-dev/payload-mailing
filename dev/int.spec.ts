import type { Payload } from 'payload'

import config from '@payload-config'
import { processEmails, retryFailedEmails, sendEmail } from '@xtr-dev/payload-mailing'
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

  test('sendEmail with a template stores the template slug', async () => {
    // The dev app uses SQLite, where relationship IDs are numbers.
    const email = await sendEmail(payload, {
      data: { to: 'slug@test.com' },
      template: { slug: 'welcome-email', variables: { firstName: 'Ada', siteName: 'Test' } },
    })

    const reloaded = await payload.findByID({ collection: 'emails', id: email.id })
    expect(reloaded.templateSlug).toBe('welcome-email')
  })

  test('sendEmail({ processImmediately: true }) runs the job on a non-default queue', async () => {
    const email = await sendEmail(payload, {
      data: {
        html: '<p>Immediate</p>',
        subject: 'Immediate send on another queue',
        to: 'immediate-queue@test.com',
      },
      processImmediately: true,
      queue: 'high',
    })

    const reloaded = await payload.findByID({ collection: 'emails', id: email.id })
    expect(reloaded.status).not.toBe('pending')
  })

  test('a failed send queues a retry job delayed by retryDelay on the same queue', async () => {
    // Make the adapter fail for this one send; the service calls
    // payload.email.sendEmail at send time, so swapping it here is enough.
    const originalSendEmail = payload.email.sendEmail
    payload.email.sendEmail = () => Promise.reject(new Error('smtp down'))
    const before = Date.now()
    let emailId: number | string
    try {
      const email = await sendEmail(payload, {
        data: { html: '<p>Retry</p>', subject: 'Retry me', to: 'retry@test.com' },
        processImmediately: true,
        queue: 'high',
      })
      emailId = email.id
    } finally {
      payload.email.sendEmail = originalSendEmail
    }

    const reloaded = await payload.findByID({ collection: 'emails', id: emailId })
    expect(reloaded.status).toBe('pending')
    expect(reloaded.attempts).toBe(1)

    const jobs = await payload.find({
      collection: 'payload-jobs',
      limit: 100,
      where: { taskSlug: { equals: 'process-email' } },
    })
    const retryJobs = (jobs.docs as { completedAt?: null | string, input?: { emailId?: string }, queue?: string, waitUntil?: null | string }[])
      .filter((job) => job.input?.emailId === String(emailId) && !job.completedAt)
    expect(retryJobs).toHaveLength(1)
    expect(retryJobs[0].queue).toBe('high')
    // The dev config sets retryDelay to one minute.
    const waitUntil = new Date(retryJobs[0].waitUntil as string).getTime()
    expect(waitUntil).toBeGreaterThanOrEqual(before + 60000)
    expect(waitUntil).toBeLessThan(Date.now() + 60000 + 1000)
  })

  test('retryFailedEmails sends an email that used up its attempts', async () => {
    // An email only reaches `failed` once all retryAttempts (3 in the dev
    // config) are used, so that is the state retryFailedEmails has to find.
    const failed = await payload.create({
      collection: 'emails',
      data: {
        attempts: 3,
        html: '<p>Failed before</p>',
        lastAttemptAt: new Date(Date.now() - 2 * 60000).toISOString(),
        status: 'failed',
        subject: 'Exhausted',
        to: ['exhausted@test.com'],
      },
    })

    await retryFailedEmails(payload)

    const reloaded = await payload.findByID({ collection: 'emails', id: failed.id })
    expect(reloaded.status).toBe('sent')
  })

  test('processEmails releases and sends an email left processing by a crashed run', async () => {
    // A crash between the claim and the final status update leaves the email
    // `processing` with the claim's lastAttemptAt; 20 minutes is past the
    // default 15-minute processingTimeout.
    const stuck = await payload.create({
      collection: 'emails',
      data: {
        attempts: 0,
        html: '<p>Stuck</p>',
        lastAttemptAt: new Date(Date.now() - 20 * 60000).toISOString(),
        status: 'processing',
        subject: 'Stuck in processing',
        to: ['stuck@test.com'],
      },
    })
    // A claim younger than the timeout is an in-flight send and must be left alone.
    const inFlight = await payload.create({
      collection: 'emails',
      data: {
        attempts: 0,
        html: '<p>In flight</p>',
        lastAttemptAt: new Date().toISOString(),
        status: 'processing',
        subject: 'Still sending',
        to: ['inflight@test.com'],
      },
    })

    await processEmails(payload)

    const recovered = await payload.findByID({ collection: 'emails', id: stuck.id })
    expect(recovered.status).toBe('sent')
    // The interrupted try counts as an attempt.
    expect(recovered.attempts).toBe(1)
    const untouched = await payload.findByID({ collection: 'emails', id: inFlight.id })
    expect(untouched.status).toBe('processing')
    expect(untouched.attempts).toBe(0)
  })

  test('retryFailedEmails retries a stuck email whose attempts are used up', async () => {
    const stuck = await payload.create({
      collection: 'emails',
      data: {
        attempts: 2,
        html: '<p>Stuck last try</p>',
        lastAttemptAt: new Date(Date.now() - 20 * 60000).toISOString(),
        status: 'processing',
        subject: 'Stuck on the last attempt',
        to: ['stuck-last@test.com'],
      },
    })

    await retryFailedEmails(payload)

    const reloaded = await payload.findByID({ collection: 'emails', id: stuck.id })
    expect(reloaded.status).toBe('sent')
    expect(reloaded.attempts).toBe(3)
  })

  test('setting a failed email back to pending queues a job even when its old job is kept', async () => {
    const email = await payload.create({
      collection: 'emails',
      data: { html: '<p>Again</p>', subject: 'Send again', to: ['again@test.com'] },
    })
    const jobsFor = async () => {
      const { docs } = await payload.find({
        collection: 'payload-jobs',
        limit: 100,
        where: { taskSlug: { equals: 'process-email' } },
      })
      return (docs as { completedAt?: null | string, id: number | string, input?: { emailId?: string } }[])
        .filter((job) => job.input?.emailId === String(email.id))
    }
    const [firstJob] = await jobsFor()
    expect(firstJob).toBeDefined()

    // A host with deleteJobOnComplete: false keeps the finished job around.
    await payload.update({
      id: firstJob.id,
      collection: 'payload-jobs',
      data: { completedAt: new Date().toISOString(), processing: false },
    })
    await payload.update({
      id: email.id,
      collection: 'emails',
      data: { attempts: 3, status: 'failed' },
    })

    // An admin puts the email back in the queue.
    await payload.update({ id: email.id, collection: 'emails', data: { status: 'pending' } })

    const runnable = (await jobsFor()).filter((job) => !job.completedAt)
    expect(runnable).toHaveLength(1)
  })
})
