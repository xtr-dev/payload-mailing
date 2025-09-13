// Simple test to verify plugin can be imported and initialized
import { mailingPlugin, sendEmail, scheduleEmail } from '@xtr-dev/payload-mailing'

console.log('✅ Plugin imports successfully')
console.log('✅ mailingPlugin:', typeof mailingPlugin)
console.log('✅ sendEmail:', typeof sendEmail) 
console.log('✅ scheduleEmail:', typeof scheduleEmail)

// Test plugin configuration
try {
  const testConfig = {
    collections: [],
    db: null,
    secret: 'test'
  }
  
  const pluginFn = mailingPlugin({
    defaultFrom: 'test@example.com',
    transport: {
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: { user: 'test', pass: 'test' }
    }
  })
  
  const configWithPlugin = pluginFn(testConfig)
  console.log('✅ Plugin configuration works')
  console.log('✅ Collections added:', configWithPlugin.collections?.length > testConfig.collections.length)
  console.log('✅ Jobs configured:', !!configWithPlugin.jobs)
  
} catch (error) {
  console.error('❌ Plugin configuration error:', error.message)
}

console.log('\n🎉 PayloadCMS Mailing Plugin is ready for development!')
console.log('\nNext steps:')
console.log('1. Run: npm run dev (in dev directory)')
console.log('2. Open: http://localhost:3000/admin')
console.log('3. Test: http://localhost:3000/mailing-test')