import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmail } from '@xtr-dev/payload-mailing'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { type = 'send', templateSlug, to, variables, scheduledAt, subject, html, text } = body

    // Use the new sendEmail API
    const emailOptions: any = {
      data: {
        to,
      }
    }

    // Add template if provided
    if (templateSlug) {
      emailOptions.template = {
        slug: templateSlug,
        variables: variables || {}
      }
    } else if (subject && html) {
      // Direct email without template
      emailOptions.data.subject = subject
      emailOptions.data.html = html
      if (text) {
        emailOptions.data.text = text
      }
    } else {
      return Response.json({
        error: 'Either templateSlug or subject+html must be provided'
      }, { status: 400 })
    }

    // Add scheduling if needed
    if (type === 'schedule' || scheduledAt) {
      emailOptions.data.scheduledAt = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60000)
    }

    const result = await sendEmail(payload, emailOptions)

    return Response.json({
      success: true,
      emailId: result.id,
      message: scheduledAt ? 'Email scheduled successfully' : 'Email queued successfully',
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
