import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ImmediateProcessingError, sendEmail } from './sendEmail.js'

const emailData = {
  html: '<p>Hello</p>',
  subject: 'Hello',
  to: ['person@example.com'],
}

const createPayload = () => {
  const create = vi.fn().mockResolvedValue({ id: 'email-1' })
  const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
  // What sendEmail reads back after the inline job run; `sent` is the outcome
  // of a successful delivery.
  const findByID = vi.fn().mockResolvedValue({ id: 'email-1', status: 'sent' })
  const queue = vi.fn().mockResolvedValue({ id: 'job-queued' })
  const run = vi.fn().mockResolvedValue(undefined)

  return {
    collections: {},
    create,
    find,
    findByID,
    jobs: { queue, run },
    logger: {
      child: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      })),
    },
    mailing: {
      collections: { emails: 'emails' },
      config: {},
    },
  }
}

describe('sendEmail processImmediately', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('runs the job handed off through the create context without polling or queueing', async () => {
    const payload = createPayload()
    payload.create.mockImplementationOnce((args) => {
      args.context.emailJobIds = ['job-1']
      return Promise.resolve({ id: 'email-1' })
    })

    await sendEmail(payload as never, { data: emailData, processImmediately: true })

    expect(payload.jobs.run).toHaveBeenCalledOnce()
    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: 'job-1' } },
    })
    expect(payload.jobs.queue).not.toHaveBeenCalled()
    expect(payload.find).not.toHaveBeenCalled()
  })

  test('queues a fallback job and runs the returned job id when no id is handed off', async () => {
    const payload = createPayload()

    await sendEmail(payload as never, { data: emailData, processImmediately: true })

    expect(payload.jobs.queue).toHaveBeenCalledOnce()
    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({
      input: { emailId: 'email-1' },
      task: 'process-email',
    }))
    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: 'job-queued' } },
    })
  })

  test('stringifies a numeric handed-off job id', async () => {
    const payload = createPayload()
    payload.create.mockImplementationOnce((args) => {
      args.context.emailJobIds = [7]
      return Promise.resolve({ id: 'email-1' })
    })

    await sendEmail(payload as never, { data: emailData, processImmediately: true })

    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: '7' } },
    })
  })

  test('runs only the first handed-off job id', async () => {
    const payload = createPayload()
    payload.create.mockImplementationOnce((args) => {
      args.context.emailJobIds = ['a', 'b']
      return Promise.resolve({ id: 'email-1' })
    })

    await sendEmail(payload as never, { data: emailData, processImmediately: true })

    expect(payload.jobs.run).toHaveBeenCalledOnce()
    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: 'a' } },
    })
  })

  test('creates the email before rejecting when jobs are not configured', async () => {
    const payload = createPayload()
    const payloadWithoutJobs = { ...payload, jobs: undefined }

    await expect(sendEmail(payloadWithoutJobs as never, {
      data: emailData,
      processImmediately: true,
    })).rejects.toThrow(/jobs not configured/)
    expect(payload.create).toHaveBeenCalledOnce()
  })

  test('wraps job failures with the email id and original error', async () => {
    const payload = createPayload()
    payload.create.mockImplementationOnce((args) => {
      args.context.emailJobIds = ['job-1']
      return Promise.resolve({ id: 'email-1' })
    })
    payload.jobs.run.mockRejectedValueOnce(new Error('boom'))

    await expect(sendEmail(payload as never, {
      data: emailData,
      processImmediately: true,
    })).rejects.toThrow(/email-1.*boom/)
  })

  test('does not queue or run a job by itself when processImmediately is omitted', async () => {
    const payload = createPayload()

    await sendEmail(payload as never, { data: emailData })

    expect(payload.jobs.queue).not.toHaveBeenCalled()
    expect(payload.jobs.run).not.toHaveBeenCalled()
  })

  test('returns the email as it is after the inline run when it was sent', async () => {
    const payload = createPayload()
    payload.findByID.mockResolvedValueOnce({ id: 'email-1', sentAt: '2026-01-01T00:00:00.000Z', status: 'sent' })

    const email = await sendEmail(payload as never, { data: emailData, processImmediately: true })

    expect(payload.findByID).toHaveBeenCalledWith({ id: 'email-1', collection: 'emails' })
    expect(email).toEqual({ id: 'email-1', sentAt: '2026-01-01T00:00:00.000Z', status: 'sent' })
  })

  test('throws ImmediateProcessingError when the job run resolves but the delivery failed', async () => {
    const payload = createPayload()
    payload.create.mockImplementationOnce((args) => {
      args.context.emailJobIds = ['job-1']
      return Promise.resolve({ id: 'email-1' })
    })
    // The state the mailing service leaves behind after a failed delivery with
    // attempts left: back to pending, with the adapter's error recorded.
    const afterFailure = { id: 'email-1', attempts: 1, error: 'smtp down', status: 'pending' }
    payload.findByID.mockResolvedValueOnce(afterFailure)

    const error = await sendEmail(payload as never, { data: emailData, processImmediately: true })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ImmediateProcessingError)
    const immediateError = error as ImmediateProcessingError
    expect(immediateError.email).toEqual(afterFailure)
    expect(immediateError.email.id).toBe('email-1')
    expect(immediateError.jobId).toBe('job-1')
    expect(immediateError.message).toMatch(/email-1.*smtp down/)
  })

  test('throws ImmediateProcessingError when the email used up its attempts inline', async () => {
    const payload = createPayload()
    payload.findByID.mockResolvedValueOnce({ id: 'email-1', attempts: 1, error: 'smtp down', status: 'failed' })

    const error = await sendEmail(payload as never, { data: emailData, processImmediately: true })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ImmediateProcessingError)
    expect((error as ImmediateProcessingError).email.status).toBe('failed')
  })

  test('throws ImmediateProcessingError when the inline run left the email untouched', async () => {
    const payload = createPayload()
    payload.findByID.mockResolvedValueOnce({ id: 'email-1', attempts: 0, status: 'pending' })

    await expect(sendEmail(payload as never, { data: emailData, processImmediately: true }))
      .rejects.toThrow(/email-1.*status: pending/)
  })

  test('throws ImmediateProcessingError when the outcome cannot be read back', async () => {
    const payload = createPayload()
    payload.findByID.mockRejectedValueOnce(new Error('db gone'))

    const error = await sendEmail(payload as never, { data: emailData, processImmediately: true })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ImmediateProcessingError)
    expect((error as ImmediateProcessingError).email.id).toBe('email-1')
    expect((error as ImmediateProcessingError).message).toMatch(/db gone/)
  })

  test('returns a future-scheduled email as pending instead of throwing', async () => {
    const payload = createPayload()
    const scheduledAt = new Date(Date.now() + 60_000)
    // The job runner skips a job whose waitUntil is in the future, so the email
    // is still pending and untried after the inline run.
    const stillScheduled = { id: 'email-1', attempts: 0, scheduledAt: scheduledAt.toISOString(), status: 'pending' }
    payload.findByID.mockResolvedValueOnce(stillScheduled)

    const email = await sendEmail(payload as never, {
      data: { ...emailData, scheduledAt },
      processImmediately: true,
    })

    expect(payload.jobs.queue).toHaveBeenCalledWith(expect.objectContaining({
      input: { emailId: 'email-1' },
      task: 'process-email',
      waitUntil: scheduledAt,
    }))
    expect(payload.jobs.run).toHaveBeenCalledOnce()
    expect(payload.jobs.run).toHaveBeenCalledWith({
      allQueues: true,
      where: { id: { equals: 'job-queued' } },
    })
    expect(email).toEqual(stillScheduled)
  })
})
