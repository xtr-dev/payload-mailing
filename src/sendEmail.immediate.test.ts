import { beforeEach, describe, expect, test, vi } from 'vitest'

import { sendEmail } from './sendEmail.js'

const emailData = {
  html: '<p>Hello</p>',
  subject: 'Hello',
  to: 'person@example.com',
}

const createPayload = () => {
  const create = vi.fn().mockResolvedValue({ id: 'email-1' })
  const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
  const queue = vi.fn().mockResolvedValue({ id: 'job-queued' })
  const run = vi.fn().mockResolvedValue(undefined)

  return {
    collections: {},
    create,
    find,
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

  test('runs immediately even when the fallback job has a future waitUntil', async () => {
    const payload = createPayload()
    const scheduledAt = new Date(Date.now() + 60_000)

    await sendEmail(payload as never, {
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
      where: { id: { equals: 'job-queued' } },
    })
  })
})
