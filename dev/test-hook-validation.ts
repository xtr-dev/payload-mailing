// Test hook validation in the dev environment
import { getPayload } from 'payload'
import config from './payload.config.js'

async function testHookValidation() {
  const payload = await getPayload({ config: await config })

  console.log('\n🧪 Testing beforeSend hook validation...\n')

  // Test 1: Create an email to process
  const email = await payload.create({
    collection: 'emails',
    data: {
      to: ['test@example.com'],
      subject: 'Test Email for Validation',
      html: '<p>Testing hook validation</p>',
      text: 'Testing hook validation',
      status: 'pending'
    }
  })

  console.log('✅ Test email created:', email.id)

  // Get the mailing service
  const mailingService = (payload as any).mailing.service

  // Test 2: Temporarily replace the config with a bad hook
  const originalBeforeSend = mailingService.config.beforeSend

  console.log('\n📝 Test: Hook that removes "from" field...')
  mailingService.config.beforeSend = async (options: any, email: any) => {
    delete options.from
    return options
  }

  try {
    await mailingService.processEmails()
    console.log('❌ Should have thrown error for missing "from"')
  } catch (error: any) {
    if (error.message.includes('must not remove the "from" property')) {
      console.log('✅ Correctly caught missing "from" field')
    } else {
      console.log('❌ Unexpected error:', error.message)
    }
  }

  console.log('\n📝 Test: Hook that empties "to" array...')
  mailingService.config.beforeSend = async (options: any, email: any) => {
    options.to = []
    return options
  }

  try {
    await mailingService.processEmails()
    console.log('❌ Should have thrown error for empty "to"')
  } catch (error: any) {
    if (error.message.includes('must not remove or empty the "to" property')) {
      console.log('✅ Correctly caught empty "to" array')
    } else {
      console.log('❌ Unexpected error:', error.message)
    }
  }

  console.log('\n📝 Test: Hook that removes "subject"...')
  mailingService.config.beforeSend = async (options: any, email: any) => {
    delete options.subject
    return options
  }

  try {
    await mailingService.processEmails()
    console.log('❌ Should have thrown error for missing "subject"')
  } catch (error: any) {
    if (error.message.includes('must not remove the "subject" property')) {
      console.log('✅ Correctly caught missing "subject" field')
    } else {
      console.log('❌ Unexpected error:', error.message)
    }
  }

  console.log('\n📝 Test: Hook that removes both "html" and "text"...')
  mailingService.config.beforeSend = async (options: any, email: any) => {
    delete options.html
    delete options.text
    return options
  }

  try {
    await mailingService.processEmails()
    console.log('❌ Should have thrown error for missing content')
  } catch (error: any) {
    if (error.message.includes('must not remove both "html" and "text" properties')) {
      console.log('✅ Correctly caught missing content fields')
    } else {
      console.log('❌ Unexpected error:', error.message)
    }
  }

  // Restore original hook
  mailingService.config.beforeSend = originalBeforeSend

  console.log('\n✅ All validation tests completed!\n')

  // Clean up
  await payload.delete({
    collection: 'emails',
    id: email.id
  })

  process.exit(0)
}

testHookValidation().catch(console.error)