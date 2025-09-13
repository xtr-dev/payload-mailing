import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    
    // Queue the combined email queue processing job
    const job = await payload.jobs.queue({
      task: 'process-email-queue',
      input: {},
    })
    
    return Response.json({
      success: true,
      message: 'Email queue processing job queued successfully (will process both pending and failed emails)',
      jobId: job.id,
    })
  } catch (error) {
    console.error('Process emails error:', error)
    return Response.json(
      { 
        error: 'Failed to process emails',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    
    // Get email queue statistics
    const pending = await payload.count({
      collection: 'emails' as const,
      where: { status: { equals: 'pending' } },
    })
    
    const processing = await payload.count({
      collection: 'emails' as const,
      where: { status: { equals: 'processing' } },
    })
    
    const sent = await payload.count({
      collection: 'emails' as const,
      where: { status: { equals: 'sent' } },
    })
    
    const failed = await payload.count({
      collection: 'emails' as const,
      where: { status: { equals: 'failed' } },
    })

    return Response.json({
      statistics: {
        pending: pending.totalDocs,
        processing: processing.totalDocs,
        sent: sent.totalDocs,
        failed: failed.totalDocs,
        total: pending.totalDocs + processing.totalDocs + sent.totalDocs + failed.totalDocs,
      },
    })
  } catch (error) {
    console.error('Get email stats error:', error)
    return Response.json(
      { 
        error: 'Failed to get email statistics',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
