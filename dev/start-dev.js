#!/usr/bin/env node

// Development startup script for PayloadCMS Mailing Plugin
// This ensures proper environment setup and provides helpful information

console.log('🚀 PayloadCMS Mailing Plugin - Development Mode')
console.log('=' .repeat(50))

// Set development environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Enable in-memory MongoDB by default for development
if (!process.env.DATABASE_URI) {
  process.env.USE_MEMORY_DB = 'true'
  console.log('📦 Using in-memory MongoDB (no installation required)')
} else {
  console.log(`🔗 Using external MongoDB: ${process.env.DATABASE_URI}`)
}

console.log('')
console.log('🔧 Starting development server...')
console.log('📧 Mailing plugin configured with test transport')
console.log('🎯 Test interface will be available at: /mailing-test')
console.log('')

// Import and start Next.js
import('next/dist/cli/next-dev.js')
  .then(({ nextDev }) => {
    nextDev([])
  })
  .catch((error) => {
    console.error('❌ Failed to start development server:', error)
    process.exit(1)
  })

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...')
  process.exit(0)
})