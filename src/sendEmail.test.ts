import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ImmediateProcessingError, sendEmail } from './sendEmail.js'
import { processJobById } from './utils/emailProcessor.js'
import { ensureEmailJob } from './utils/jobScheduler.js'

vi.mock('./utils/emailProcessor.js', () => ({
  processJobById: vi.fn(),
}))

vi.mock('./utils/jobScheduler.js', () => ({
  ensureEmailJob: vi.fn(),
}))

// context is the same object sendEmail passes as payload.create's `context`
// option; mutating it here stands in for the Emails afterChange hook handing
// job IDs back through it.
const makePayload = (onCreate?: (context: { emailJobIds?: (number | string)[] }) => void) => {
  const create = vi.fn((args: { context: { emailJobIds?: (number | string)[] }, data: Record<string, unknown> }) => {
    onCreate?.(args.context)
    return Promise.resolve({ id: 'email-1' })
  })

  return {
    create,
    jobs: { run: vi.fn() },
    mailing: {
      collections: { emails: 'emails', templates: 'email-templates' },
    },
  }
}

const directEmail = {
  html: '<p>hi</p>',
  subject: 'hi',
  to: 'to@example.com',
}

describe('sendEmail data input contract', () => {
  test('accepts scalar-string recipients as documented and normalizes them before create', async () => {
    const payload = makePayload()

    await sendEmail(payload as never, {
      data: {
        bcc: 'bcc@example.com',
        cc: 'cc@example.com',
        from: 'from@example.com',
        html: '<p>hi</p>',
        replyTo: 'reply@example.com',
        subject: 'hi',
        to: 'to@example.com',
      },
    })

    const created = payload.create.mock.calls[0][0].data
    expect(created.to).toEqual(['to@example.com'])
    expect(created.cc).toEqual(['cc@example.com'])
    expect(created.bcc).toEqual(['bcc@example.com'])
    expect(created.from).toBe('from@example.com')
    expect(created.replyTo).toBe('reply@example.com')
  })
})

describe('sendEmail immediate-processing queue handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('processes the job id handed back through the create context, without calling ensureEmailJob', async () => {
    const payload = makePayload((context) => {
      context.emailJobIds = ['job-7']
    })

    await sendEmail(payload as never, {
      data: directEmail,
      processImmediately: true,
    })

    expect(processJobById).toHaveBeenCalledWith(payload, 'job-7')
    expect(ensureEmailJob).not.toHaveBeenCalled()
  })

  test('falls back to ensureEmailJob when create does not hand back a job id in context', async () => {
    const payload = makePayload()
    vi.mocked(ensureEmailJob).mockResolvedValue({ created: true, jobIds: ['job-fallback'] })

    await sendEmail(payload as never, {
      data: directEmail,
      processImmediately: true,
    })

    expect(ensureEmailJob).toHaveBeenCalledTimes(1)
    expect(ensureEmailJob).toHaveBeenCalledWith(payload, 'email-1', { scheduledAt: undefined })
    expect(processJobById).toHaveBeenCalledWith(payload, 'job-fallback')
  })

  test('refuses immediate processing when payload.jobs is not configured', async () => {
    const payload = { ...makePayload(), jobs: undefined }

    await expect(sendEmail(payload as never, {
      data: directEmail,
      processImmediately: true,
    })).rejects.toThrow('PayloadCMS jobs not configured - cannot process email immediately')

    expect(processJobById).not.toHaveBeenCalled()
    expect(ensureEmailJob).not.toHaveBeenCalled()
  })

  test('wraps a processJobById failure with the email id', async () => {
    const payload = makePayload((context) => {
      context.emailJobIds = ['job-7']
    })
    vi.mocked(processJobById).mockRejectedValue(new Error('adapter exploded'))

    await expect(sendEmail(payload as never, {
      data: directEmail,
      processImmediately: true,
    })).rejects.toThrow('Failed to process email email-1 immediately: Error: adapter exploded')
  })

  test('reports an inline-run failure as ImmediateProcessingError carrying the created email', async () => {
    const payload = makePayload((context) => {
      context.emailJobIds = ['job-7']
    })
    const cause = new Error('adapter exploded')
    vi.mocked(processJobById).mockRejectedValue(cause)

    const error = await sendEmail(payload as never, {
      data: directEmail,
      processImmediately: true,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ImmediateProcessingError)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      name: 'ImmediateProcessingError',
      cause,
      email: { id: 'email-1' },
      jobId: 'job-7',
    })
  })

  test('throws a plain Error, not ImmediateProcessingError, when no email was created', async () => {
    const payload = makePayload()

    const error = await sendEmail(payload as never, {
      data: { ...directEmail, to: 'not-an-address' },
      processImmediately: true,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(ImmediateProcessingError)
    expect(payload.create).not.toHaveBeenCalled()
  })
})

// Separate factory: parseAndValidateEmails runs before payload.create, so these
// cases only need create to exist (and to stay uncalled).
const makeRecipientPayload = () => ({
  collections: { 'email-templates': {} },
  create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'email-1', ...data })),
  find: vi.fn(),
  jobs: { run: vi.fn() },
  mailing: {
    collections: { emails: 'emails', templates: 'email-templates' },
    service: { renderTemplateDocument: vi.fn() },
  },
})

describe('sendEmail recipient normalization', () => {
  test.each([
    { to: ' , ' },
    { to: ',,,' },
    { to: [] },
  ])('rejects a $to recipient string/array that normalizes to zero addresses', async ({ to }) => {
    const payload = makeRecipientPayload()

    await expect(sendEmail(payload as never, {
      data: { html: '<p>x</p>', subject: 'x', to },
    } as never)).rejects.toThrow('Field "to" is required for sending emails')
    expect(payload.create).not.toHaveBeenCalled()
  })
})
