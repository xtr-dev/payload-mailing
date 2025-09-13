import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmail, scheduleEmail } from '@xtr-dev/payload-mailing'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { type = 'send', templateSlug, to, variables, scheduledAt } = body

    let result
    if (type === 'send') {
      // Send immediately
      result = await sendEmail(payload, {
        templateSlug,
        to,
        variables,
      })
    } else if (type === 'schedule') {
      // Schedule for later
      result = await scheduleEmail(payload, {
        templateSlug,
        to,
        variables,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60000), // Default to 1 minute
      })
    } else {
      return Response.json({ error: 'Invalid type. Use "send" or "schedule"' }, { status: 400 })
    }

    return Response.json({
      success: true,
      emailId: result,
      message: type === 'send' ? 'Email sent successfully' : 'Email scheduled successfully',
    })
  } catch (error) {
    console.error('Test email error:', error)
    return Response.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    
    // Get email templates
    const { docs: templates } = await payload.find({
      collection: 'email-templates' as const,
      limit: 10,
    })

    // Get email queue status
    const { docs: queuedEmails, totalDocs } = await payload.find({
      collection: 'emails' as const,
      limit: 10,
      sort: '-createdAt',
    })

    return Response.json({
      templates,
      outbox: {
        emails: queuedEmails,
        total: totalDocs,
      },
      mailing: {
        pluginActive: !!(payload as any).mailing,
        service: !!(payload as any).mailing?.service,
      },
    })
  } catch (error) {
    console.error('Get mailing status error:', error)
    return Response.json(
      { 
        error: 'Failed to get mailing status',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
