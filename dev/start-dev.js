#!/usr/bin/env node

// Development startup script for PayloadCMS Mailing Plugin
// This ensures proper environment setup and provides helpful information

// Set development environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Set default SQLite database for development
if (!process.env.DATABASE_URI) {
  process.env.DATABASE_URI = 'file:./dev.db'
}

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
  process.exit(0)
})

process.on('SIGINT', () => {
  process.exit(0)
})