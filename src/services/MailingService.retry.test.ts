import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Emails from '../collections/Emails.js'
import { SKIP_EMAIL_JOB_CONTEXT_KEY } from '../utils/jobContext.js'
import { MailingService } from './MailingService.js'

// A stub Payload with a jobs API, so the failure path's retry scheduling can be
// observed. `find` serves both the emails selection and the payload-jobs lookup
// that picks the retry job's queue.
const stubPayload = (jobsFound: any[] = []) =>
  ({
    db: {},
    email: { sendEmail: vi.fn().mockRejectedValue(new Error('smtp down')) },
    find: vi.fn().mockImplementation(({ collection }: any) =>
      Promise.resolve(collection === 'payload-jobs' ? { docs: jobsFound } : { docs: [] }),
    ),
    findByID: vi.fn(),
    jobs: { queue: vi.fn().mockResolvedValue({ id: 'retry-job' }) },
    update: vi.fn().mockResolvedValue({ docs: [{ id: '1' }] }),
  }) as any

const email = (attempts: number) => ({
  id: '1',
  attempts,
  from: 'sender@example.com',
  html: '<p>hi</p>',
  subject: 'Hello',
  to: 'user@example.com',
})

const NOW = new Date('2026-01-01T00:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a failed send with attempts left is retried automatically', () => {
  test('queues a process-email job delayed by retryDelay', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, { queue: 'mail', retryAttempts: 3, retryDelay: 60000 } as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.jobs.queue).toHaveBeenCalledTimes(1)
    expect(payload.jobs.queue).toHaveBeenCalledWith({
      input: { emailId: '1' },
      queue: 'mail',
      task: 'process-email',
      waitUntil: new Date(NOW.getTime() + 60000),
    })
  })

  test('uses the default five-minute delay and the default queue when unset', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, {} as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'default', waitUntil: new Date(NOW.getTime() + 300000) }),
    )
  })

  test('keeps the queue of the email\'s previous job (a per-send queue override)', async () => {
    const payload = stubPayload([{ id: 'job-1', input: { emailId: '1' }, queue: 'high' }])
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, { queue: 'mail' } as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({ queue: 'high' }))
  })

  test('the pending write tells the afterChange hook not to queue its own undelayed job', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, {} as any)

    await svc.processEmailItem('1', 'pending')

    const pendingWrite = payload.update.mock.calls.find((call: any[]) => call[0].data.status === 'pending')
    expect(pendingWrite[0].context).toEqual({ [SKIP_EMAIL_JOB_CONTEXT_KEY]: true })

    // Feed that write through the real hook: it must not queue anything.
    const hookPayload = { find: vi.fn(), jobs: { queue: vi.fn() } }
    const afterChange = (Emails.hooks as any).afterChange[0]
    await afterChange({
      doc: { id: '1', jobs: [], status: 'pending' },
      operation: 'update',
      previousDoc: { id: '1', status: 'processing' },
      req: { context: pendingWrite[0].context, payload: hookPayload },
    })
    expect(hookPayload.jobs.queue).not.toHaveBeenCalled()
    expect(hookPayload.find).not.toHaveBeenCalled()
  })

  test('the last allowed attempt marks the email failed and queues no retry', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(email(2))
    const svc = new MailingService(payload, { retryAttempts: 3 } as any)

    await svc.processEmailItem('1', 'pending')

    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.status).toBe('failed')
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  test('a successful send queues no retry', async () => {
    const payload = stubPayload()
    payload.email.sendEmail.mockResolvedValue(undefined)
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, {} as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  test('a lost claim queues no retry (the winning run owns the email)', async () => {
    const payload = stubPayload()
    payload.update.mockResolvedValue({ docs: [] })
    const svc = new MailingService(payload, {} as any)

    await svc.processEmailItem('1', 'pending')

    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  test('a failure to queue the retry is logged, not thrown', async () => {
    const payload = stubPayload()
    payload.findByID.mockResolvedValue(email(0))
    payload.jobs.queue.mockRejectedValue(new Error('queue down'))
    const svc = new MailingService(payload, {} as any)

    await expect(svc.processEmailItem('1', 'pending')).resolves.toBeUndefined()
  })

  test('without a jobs API the email is left pending for processEmails()', async () => {
    const payload = stubPayload()
    delete payload.jobs
    payload.findByID.mockResolvedValue(email(0))
    const svc = new MailingService(payload, {} as any)

    await expect(svc.processEmailItem('1', 'pending')).resolves.toBeUndefined()
    const finalCall = payload.update.mock.calls[payload.update.mock.calls.length - 1][0]
    expect(finalCall.data.status).toBe('pending')
  })
})

describe('processEmails honours retryDelay for emails that already failed', () => {
  test('only selects fresh emails or ones whose last attempt is at least retryDelay old', async () => {
    const payload = stubPayload()
    const svc = new MailingService(payload, { retryDelay: 60000 } as any)

    await svc.processEmails()

    const findCall = payload.find.mock.calls[0][0]
    expect(findCall.where.and[2]).toEqual({
      or: [
        { attempts: { exists: false } },
        { attempts: { equals: 0 } },
        { lastAttemptAt: { exists: false } },
        { lastAttemptAt: { less_than_equal: new Date(NOW.getTime() - 60000).toISOString() } },
      ],
    })
  })
})
