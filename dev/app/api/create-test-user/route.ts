import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    
    // Generate random user data if not provided
    const userData = {
      email: body.email || `user-${Date.now()}@example.com`,
      password: body.password || 'TestPassword123!',
      firstName: body.firstName || 'Test',
      lastName: body.lastName || 'User',
    }
    
    // Create the user
    const user = await payload.create({
      collection: 'users',
      data: userData,
    })
    
    // Check if email was queued
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay for email processing
    
    const { docs: emails } = await payload.find({
      collection: 'emails' as const,
      where: {
        to: {
          equals: userData.email,
        },
      },
      limit: 1,
      sort: '-createdAt',
    })
    
    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      emailQueued: emails.length > 0,
      email: emails.length > 0 ? {
        id: emails[0].id,
        subject: emails[0].subject,
        status: emails[0].status,
      } : null,
    })
  } catch (error) {
    console.error('Error creating test user:', error)
    return Response.json(
      { 
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return Response.json({
    message: 'Use POST to create a test user',
    example: {
      email: 'optional@example.com',
      password: 'optional',
      firstName: 'optional',
      lastName: 'optional',
    },
    note: 'All fields are optional. Random values will be generated if not provided.',
  })
}
