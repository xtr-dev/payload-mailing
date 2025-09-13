// Test script to verify slug-based template system
import { getPayload } from 'payload'
import configPromise from './dev/payload.config.js'
import { sendEmail } from './dist/utils/helpers.js'

async function testSlugSystem() {
  console.log('🔄 Testing slug-based template system...\n')
  
  try {
    const config = await configPromise
    const payload = await getPayload({ config })
    
    console.log('📝 Sending email using template slug "welcome-email"')
    
    const emailId = await sendEmail(payload, {
      templateSlug: 'welcome-email',
      to: 'test-slug@example.com',
      variables: {
        firstName: 'SlugTest',
        siteName: 'Slug Demo Site',
        createdAt: new Date().toISOString(),
        isPremium: true,
        dashboardUrl: 'http://localhost:3000/admin',
      },
    })
    
    console.log('✅ Email queued successfully with ID:', emailId)
    
    // Check if email was queued with templateSlug
    const email = await payload.findByID({
      collection: 'emails',
      id: emailId,
    })
    
    console.log('\n📧 Email details:')
    console.log('- ID:', email.id)
    console.log('- To:', email.to)
    console.log('- Subject:', email.subject)
    console.log('- Template Slug:', email.templateSlug)
    console.log('- Status:', email.status)
    console.log('- Subject contains personalized data:', email.subject.includes('SlugTest'))
    
    if (email.templateSlug === 'welcome-email') {
      console.log('\n✅ Slug-based template system working correctly!')
    } else {
      console.log('\n❌ Template slug not stored correctly')
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testSlugSystem()