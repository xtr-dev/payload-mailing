import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })

    // Run jobs in the default queue (the plugin already schedules email processing on init)
    const results = await payload.jobs.run({
      queue: 'default',
    })

    const processedCount = Array.isArray(results) ? results.length : (results ? 1 : 0)

    return Response.json({
      success: true,
      message: `Email queue processing completed. Processed ${processedCount} jobs.`,
      processedJobs: processedCount,
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
