# PayloadCMS Mailing Plugin - Development Setup

This directory contains a complete PayloadCMS application for testing and developing the mailing plugin.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server (with in-memory MongoDB):**
   ```bash
   npm run dev
   ```
   
   **Alternative startup methods:**
   ```bash
   # Force in-memory database (from root directory)
   npm run dev:memory
   
   # With startup script and helpful info
   npm run dev:start
   
   # From dev directory
   cd dev && npm run dev
   ```

3. **Optional: Set up environment file:**
   ```bash
   cp ../.env.example .env
   # Edit .env if you want to use external MongoDB
   ```

4. **Access the application:**
   - Admin Panel: http://localhost:3000/admin
   - Mailing Test Page: http://localhost:3000/mailing-test
   - GraphQL Playground: http://localhost:3000/api/graphql-playground

## Features Included

### ✅ **Mailing Plugin Integration**
- Configured with test email transport
- Example email templates automatically created
- Collections: `email-templates` and `email-outbox`

### ✅ **Test Interface**
- Web UI at `/mailing-test` for testing emails
- Send emails immediately or schedule for later
- View outbox status and email history
- Process outbox manually

### ✅ **API Endpoints**
- `POST /api/test-email` - Send/schedule test emails
- `GET /api/test-email` - Get templates and outbox status
- `POST /api/process-outbox` - Manually process outbox
- `GET /api/process-outbox` - Get outbox statistics

### ✅ **Example Templates**
1. **Welcome Email** - New user onboarding
2. **Order Confirmation** - E-commerce order receipt
3. **Password Reset** - Security password reset

## Email Testing

### Option 1: MailHog (Recommended)
```bash
# Install MailHog
go install github.com/mailhog/MailHog@latest

# Run MailHog
MailHog
```
- SMTP: localhost:1025 (configured in dev)
- Web UI: http://localhost:8025

### Option 2: Console Logs
The dev environment uses `testEmailAdapter` which logs emails to console.

## Testing the Plugin

1. **Via Web Interface:**
   - Go to http://localhost:3000/mailing-test
   - Select a template
   - Fill in variables
   - Send or schedule email

2. **Via Admin Panel:**
   - Go to http://localhost:3000/admin
   - Navigate to "Mailing > Email Templates" 
   - Create/edit templates
   - Navigate to "Mailing > Email Outbox"
   - View scheduled/sent emails

3. **Via API:**
   ```bash
   # Send welcome email
   curl -X POST http://localhost:3000/api/test-email \\
     -H "Content-Type: application/json" \\
     -d '{
       "type": "send",
       "templateId": "TEMPLATE_ID",
       "to": "test@example.com",
       "variables": {
         "firstName": "John",
         "siteName": "Test Site"
       }
     }'
   ```

## Development Workflow

1. **Make changes to plugin source** (`../src/`)
2. **Rebuild plugin:** `npm run build` (in root)
3. **Restart dev server:** The dev server watches for changes
4. **Test changes** via web interface or API

## Database Configuration

The development setup automatically uses **MongoDB in-memory database** by default - no MongoDB installation required!

### 🚀 **In-Memory MongoDB (Default)**
- ✅ **Zero setup** - Works out of the box
- ✅ **No installation** required
- ✅ **Fast startup** - Ready in seconds  
- ⚠️ **Data resets** on server restart
- 💾 **Perfect for development** and testing

### 🔧 **Database Options**

1. **In-Memory (Recommended for Development):**
   ```bash
   # Automatic - just start the server
   npm run dev
   
   # Or explicitly enable
   USE_MEMORY_DB=true npm run dev
   ```

2. **Local MongoDB:**
   ```bash
   # Install MongoDB locally, then:
   DATABASE_URI=mongodb://localhost:27017/payload-mailing-dev npm run dev
   ```

3. **Remote MongoDB:**
   ```bash
   # Set your connection string:
   DATABASE_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname npm run dev
   ```

### 💡 **Database Startup Messages**
When you start the dev server, you'll see helpful messages:
```
🚀 Starting MongoDB in-memory database...
✅ MongoDB in-memory database started  
📊 Database URI: mongodb://***@localhost:port/payload-mailing-dev
```

## Jobs Processing

The plugin automatically processes the outbox every 5 minutes and retries failed emails every 30 minutes. You can also trigger manual processing via:
- Web interface "Process Outbox" button  
- API endpoint `POST /api/process-outbox`

## Troubleshooting

### Email not sending:
1. Check MailHog is running on port 1025
2. Check console logs for errors
3. Verify template variables are correct
4. Check outbox collection for error messages

### Plugin not loading:
1. Ensure plugin is built: `npm run build` in root
2. Check console for initialization message
3. Verify plugin configuration in `payload.config.ts`

### Templates not appearing:
1. Check seed function ran successfully
2. Verify database connection
3. Check admin panel collections

## Plugin API Usage

```javascript
import { sendEmail } from '@xtr-dev/payload-mailing'

// Send immediate email with template
const email = await sendEmail(payload, {
  template: {
    slug: 'welcome-email',
    variables: {
      firstName: 'John',
      siteName: 'My App'
    }
  },
  data: {
    to: 'user@example.com',
  }
})

// Schedule email for later
const scheduledEmail = await sendEmail(payload, {
  template: {
    slug: 'reminder',
    variables: {
      eventName: 'Product Launch'
    }
  },
  data: {
    to: 'user@example.com',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  }
})

// Send direct HTML email (no template)
const directEmail = await sendEmail(payload, {
  data: {
    to: 'user@example.com',
    subject: 'Direct Email',
    html: '<h1>Hello World</h1>',
    text: 'Hello World'
  }
})
```