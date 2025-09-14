import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmail, processEmailById } from '@xtr-dev/payload-mailing'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { type = 'send', templateSlug, to, variables, scheduledAt, subject, html, text } = body

    // Validate required fields
    if (!to) {
      return Response.json(
        { error: 'Recipient email address (to) is required' },
        { status: 400 }
      )
    }

    // Validate email has either template or direct content
    if (!templateSlug && (!subject || !html)) {
      return Response.json(
        { error: 'Either templateSlug or both subject and html must be provided' },
        { status: 400 }
      )
    }

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

    // If it's "send now" (not scheduled), process the email immediately
    if (type === 'send' && !scheduledAt) {
      try {
        await processEmailById(payload, String(result.id))
        return Response.json({
          success: true,
          emailId: result.id,
          message: 'Email sent successfully',
          status: 'sent'
        })
      } catch (processError) {
        // If immediate processing fails, return that it's queued
        console.warn('Failed to process email immediately, left in queue:', processError)
        return Response.json({
          success: true,
          emailId: result.id,
          message: 'Email queued successfully (immediate processing failed)',
          status: 'queued'
        })
      }
    }

    return Response.json({
      success: true,
      emailId: result.id,
      message: scheduledAt ? 'Email scheduled successfully' : 'Email queued successfully',
      status: scheduledAt ? 'scheduled' : 'queued'
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
        pluginActive: 'mailing' in payload && !!payload.mailing,
        service: 'mailing' in payload && payload.mailing && 'service' in payload.mailing && !!payload.mailing.service,
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
