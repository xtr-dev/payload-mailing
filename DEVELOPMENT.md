# PayloadCMS Mailing Plugin - Development Guide

🚀 **Zero-Setup Development** with in-memory MongoDB - no database installation required!

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server with in-memory MongoDB
npm run dev

# Alternative: Use startup script with helpful info
npm run dev:start

# Alternative: Force memory database
npm run dev:memory
```

## What You Get

### 🎯 **Instant Setup**
- ✅ **In-memory MongoDB** - no installation needed
- ✅ **Example templates** automatically created
- ✅ **Test interface** at `/mailing-test`
- ✅ **Admin panel** at `/admin`
- ✅ **API endpoints** for testing

### 📧 **Pre-loaded Templates**
1. **Welcome Email** - User onboarding with premium features
2. **Order Confirmation** - E-commerce receipt with items
3. **Password Reset** - Security email with expiring link

### 🔧 **Development Tools**
- **Web UI**: http://localhost:3000/mailing-test
- **Admin Panel**: http://localhost:3000/admin  
- **GraphQL Playground**: http://localhost:3000/api/graphql-playground
- **API Endpoints**: 
  - `POST /api/test-email` - Send/schedule emails
  - `POST /api/process-outbox` - Process email queue

## Database Options

### 🚀 **In-Memory (Default - Recommended)**
```bash
npm run dev  # Automatic
```
- Zero setup required
- Fast startup (5-10 seconds)
- Data resets on restart
- Perfect for development

### 🔗 **External MongoDB**
```bash
DATABASE_URI=mongodb://localhost:27017/payload-mailing npm run dev
```

## Email Testing

### MailHog (Recommended)
```bash
# Install and run MailHog
go install github.com/mailhog/MailHog@latest
MailHog

# View emails at: http://localhost:8025
```

### Console Output
The dev setup logs emails to console if no SMTP server is available.

## Development Workflow

1. **Start server**: `npm run dev`
2. **Make changes** to plugin source (`src/`)
3. **Rebuild plugin**: `npm run build` 
4. **Test changes** in web interface or admin panel
5. **View results** in MailHog or console

## Plugin Testing

### Via Web Interface
1. Go to http://localhost:3000/mailing-test
2. Select a template
3. Fill in variables  
4. Send or schedule email
5. Check MailHog for results

### Via Admin Panel
1. Go to http://localhost:3000/admin
2. Navigate to **Mailing > Email Templates**
3. View/edit templates
4. Navigate to **Mailing > Email Outbox**  
5. Monitor email status

### Via API
```bash
curl -X POST http://localhost:3000/api/test-email \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "send",
    "templateId": "TEMPLATE_ID",
    "to": "test@example.com",
    "variables": {
      "firstName": "John",
      "siteName": "Test App"
    }
  }'
```

## Startup Messages

When you start the dev server, look for these messages:

```
🚀 PayloadCMS Mailing Plugin - Development Mode
==================================================
📦 Using in-memory MongoDB (no installation required)

🔧 Starting development server...
🚀 Starting MongoDB in-memory database...
✅ MongoDB in-memory database started
📊 Database URI: mongodb://***@localhost:port/payload-mailing-dev
📧 Mailing plugin configured with test transport
🎯 Test interface will be available at: /mailing-test

✅ Example email templates created successfully
```

**Note**: The plugin initializes silently on success (no "initialized successfully" message). If you see no errors, the plugin loaded correctly.

## Troubleshooting

### Server won't start
- Ensure port 3000 is available
- Check for Node.js version compatibility
- Run `npm install` to ensure dependencies

### Database issues
- In-memory database automatically handles setup
- For external MongoDB, verify `DATABASE_URI` is correct
- Check MongoDB is running if using external database

### Email issues  
- Verify MailHog is running on port 1025
- Check console logs for error messages
- Ensure template variables are correctly formatted

## Plugin Development

The plugin source is in `src/` directory:
- `src/plugin.ts` - Main plugin configuration
- `src/collections/` - Email templates and outbox collections
- `src/services/` - Mailing service with LiquidJS, Mustache, and simple template processing
- `src/jobs/` - Background job processing
- `src/utils/` - Helper functions for developers

Make changes, rebuild with `npm run build`, and test!

## Success Indicators

✅ Server starts without errors  
✅ Admin panel loads at `/admin`  
✅ Test interface loads at `/mailing-test`  
✅ Templates appear in the interface  
✅ Emails can be sent/scheduled  
✅ Outbox shows email status  

You're ready to develop and test the PayloadCMS Mailing Plugin! 🎉
