import type { Payload } from 'payload'

import config from '@payload-config'
import { ImmediateProcessingError, processAllEmails, processEmails, retryFailedEmails, sendEmail } from '@xtr-dev/payload-mailing'
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

  test('Liquid {% echo %} output is HTML-escaped unless it uses | raw', async () => {
    // Renders through the real liquidjs the plugin installs, so a liquidjs
    // release that changes how `echo` is escaped fails here.
    const draftContent = {
      root: {
        children: [{
          children: [{ text: '{% echo snippet %}|{% echo snippet | raw %}|{{ snippet | raw }}', type: 'text' }],
          type: 'paragraph',
        }],
      },
    }
    const req = {
      body: 'present',
      headers: new Headers({ 'Content-Length': '999', 'Content-Type': 'application/json' }),
      method: 'POST',
      payload,
      text: async () =>
        JSON.stringify({
          content: draftContent,
          subject: 'Echo',
          variables: { snippet: '<b>bold</b>' },
        }),
      user: { id: 'tester' },
    } as unknown as Parameters<typeof previewTemplateHandler>[0]

    const response = await previewTemplateHandler(req)
    expect(response.status).toBe(200)

    const result = (await response.json()) as { html: string; text: string }
    expect(result.html).toContain('&lt;b&gt;bold&lt;/b&gt;|<b>bold</b>|<b>bold</b>')
    // The plain-text part is never escaped.
    expect(result.text).toContain('<b>bold</b>|<b>bold</b>|<b>bold</b>')
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
    expect(reloaded.status).toBe('sent')
    // The returned document reflects the finished send, not the row as created.
    expect(email.status).toBe('sent')
    expect(email.sentAt).toBeTruthy()
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

  test('a failed immediate send throws ImmediateProcessingError and queues a retry job delayed by retryDelay on the same queue', async () => {
    // Make the adapter fail for this one send; the service calls
    // payload.email.sendEmail at send time, so swapping it here is enough.
    const originalSendEmail = payload.email.sendEmail
    payload.email.sendEmail = () => Promise.reject(new Error('smtp down'))
    const before = Date.now()
    let caught: unknown
    try {
      await sendEmail(payload, {
        data: { html: '<p>Retry</p>', subject: 'Retry me', to: 'retry@test.com' },
        processImmediately: true,
        queue: 'high',
      })
    } catch (error) {
      caught = error
    } finally {
      payload.email.sendEmail = originalSendEmail
    }

    // The job run itself resolves (Payload records the task error on the job),
    // so the throw has to come from sendEmail checking the email's status.
    expect(caught).toBeInstanceOf(ImmediateProcessingError)
    const immediateError = caught as ImmediateProcessingError
    expect(immediateError.message).toContain('smtp down')
    expect(immediateError.email.status).toBe('pending')
    const emailId = immediateError.email.id

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

  test('an email whose immediate send failed is delivered by a later queue run', async () => {
    const originalSendEmail = payload.email.sendEmail
    payload.email.sendEmail = () => Promise.reject(new Error('smtp down'))
    let caught: unknown
    try {
      await sendEmail(payload, {
        data: { html: '<p>Later</p>', subject: 'Delivered later', to: 'later@test.com' },
        processImmediately: true,
      })
    } catch (error) {
      caught = error
    } finally {
      payload.email.sendEmail = originalSendEmail
    }
    expect(caught).toBeInstanceOf(ImmediateProcessingError)
    const emailId = (caught as ImmediateProcessingError).email.id

    // Stand in for retryDelay (one minute in the dev config) having passed:
    // make the retry job due and move the failed attempt into the past, then
    // let the normal queue run pick the job up.
    const jobs = await payload.find({
      collection: 'payload-jobs',
      limit: 100,
      where: { taskSlug: { equals: 'process-email' } },
    })
    const retryJob = (jobs.docs as { completedAt?: null | string, id: number | string, input?: { emailId?: string } }[])
      .find((job) => job.input?.emailId === String(emailId) && !job.completedAt)
    expect(retryJob).toBeDefined()
    await payload.update({
      collection: 'payload-jobs',
      data: { waitUntil: new Date(Date.now() - 1000).toISOString() },
      id: retryJob!.id,
    })

    await payload.jobs.run({ allQueues: true, where: { id: { equals: retryJob!.id } } })

    const reloaded = await payload.findByID({ collection: 'emails', id: emailId })
    expect(reloaded.status).toBe('sent')
    expect(reloaded.attempts).toBe(1)
    expect(reloaded.error).toBeNull()
  })

  test('sendEmail({ processImmediately: true }) with a future scheduledAt leaves the email scheduled without throwing', async () => {
    const email = await sendEmail(payload, {
      data: {
        html: '<p>Scheduled</p>',
        scheduledAt: new Date(Date.now() + 3600_000),
        subject: 'Scheduled immediate send',
        to: 'scheduled-immediate@test.com',
      },
      processImmediately: true,
    })

    expect(email.status).toBe('pending')
    expect(email.attempts ?? 0).toBe(0)
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

  test('processAllEmails leaves an email that used up its attempts failed, run after run', async () => {
    const createFailed = (attempts: number, subject: string) => payload.create({
      collection: 'emails',
      data: {
        attempts,
        error: 'smtp down',
        html: '<p>Failed before</p>',
        // Older than the dev config's one-minute retryDelay, so only the
        // attempts limit can keep the email from being retried.
        lastAttemptAt: new Date(Date.now() - 2 * 60000).toISOString(),
        status: 'failed',
        subject,
        to: ['process-all@test.com'],
      },
    })
    // retryAttempts is 3 in the dev config.
    const exhausted = await createFailed(3, 'Permanently failed')
    const belowLimit = await createFailed(2, 'Failed with an attempt left')

    // Count deliveries of the exhausted email: it must never reach the adapter.
    const originalSendEmail = payload.email.sendEmail
    const deliveredSubjects: string[] = []
    payload.email.sendEmail = (message) => {
      deliveredSubjects.push(String(message.subject))
      return originalSendEmail(message)
    }
    try {
      await processAllEmails(payload)
      await processAllEmails(payload)
    } finally {
      payload.email.sendEmail = originalSendEmail
    }

    const stillFailed = await payload.findByID({ collection: 'emails', id: exhausted.id })
    expect(stillFailed.status).toBe('failed')
    expect(stillFailed.attempts).toBe(3)
    expect(deliveredSubjects).not.toContain('Permanently failed')

    // A failed email below the limit (e.g. after retryAttempts was raised) is
    // still picked up.
    const retried = await payload.findByID({ collection: 'emails', id: belowLimit.id })
    expect(retried.status).toBe('sent')
  })

  test('processAllEmails marks an email failed on the attempt that reaches retryAttempts', async () => {
    const lastTry = await payload.create({
      collection: 'emails',
      data: {
        attempts: 2,
        html: '<p>Last try</p>',
        lastAttemptAt: new Date(Date.now() - 2 * 60000).toISOString(),
        status: 'pending',
        subject: 'Last allowed attempt',
        to: ['last-try@test.com'],
      },
    })

    const originalSendEmail = payload.email.sendEmail
    let deliveries = 0
    payload.email.sendEmail = (message) => {
      if (message.subject !== 'Last allowed attempt') {
        return originalSendEmail(message)
      }
      deliveries++
      return Promise.reject(new Error('smtp down'))
    }
    try {
      await processAllEmails(payload)
      const failed = await payload.findByID({ collection: 'emails', id: lastTry.id })
      expect(failed.status).toBe('failed')
      expect(failed.attempts).toBe(3)

      // Even once retryDelay has passed, later runs skip it.
      await payload.update({
        collection: 'emails',
        data: { lastAttemptAt: new Date(Date.now() - 2 * 60000).toISOString() },
        id: lastTry.id,
      })
      await processAllEmails(payload)
      await processAllEmails(payload)
    } finally {
      payload.email.sendEmail = originalSendEmail
    }

    expect(deliveries).toBe(1)
    const reloaded = await payload.findByID({ collection: 'emails', id: lastTry.id })
    expect(reloaded.status).toBe('failed')
    expect(reloaded.attempts).toBe(3)
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
