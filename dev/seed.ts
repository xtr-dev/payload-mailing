import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.js'

export const seed = async (payload: Payload) => {
  // Create example email template
  const { totalDocs: templateCount } = await payload.count({
    collection: 'email-templates' as const,
  })

  if (templateCount === 0) {
    // Simple welcome email template
    await payload.create({
      collection: 'email-templates' as const,
      data: {
        name: 'Welcome Email',
        slug: 'welcome-email',
        subject: 'Welcome to {{siteName}}, {{firstName}}!',
        content: {
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Welcome {{firstName}}! 🎉',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                tag: 'h1',
                type: 'heading',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: "We're thrilled to have you join {{siteName}}! This email demonstrates how easy it is to create beautiful emails using PayloadCMS's rich text editor with Handlebars variables.",
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 1,
                    mode: 'normal',
                    style: '',
                    text: 'What you can do:',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
              },
              {
                children: [
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'Create beautiful emails with rich text formatting',
                        type: 'text',
                        version: 1,
                      },
                    ],
                    direction: 'ltr',
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    value: 1,
                    version: 1,
                  },
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'Create beautiful emails with rich text formatting',
                        type: 'text',
                        version: 1,
                      },
                    ],
                    direction: 'ltr',
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    value: 2,
                    version: 1,
                  },
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'Queue and schedule emails effortlessly',
                        type: 'text',
                        version: 1,
                      },
                    ],
                    direction: 'ltr',
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    value: 3,
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                listType: 'bullet',
                start: 1,
                tag: 'ul',
                type: 'list',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Get started by exploring the admin panel and creating your own email templates. Your account was created on {{formatDate createdAt "long"}}.',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Best regards,',
                    type: 'text',
                    version: 1,
                  },
                  {
                    type: 'linebreak',
                    version: 1,
                  },
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'The {{siteName}} Team',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
      },
    })

    console.log('✅ Example email template created successfully')
  }
}

export const seedUser = async (payload: Payload) => {
  // Create dev user if not exists - called after mailing plugin is initialized
  const { totalDocs } = await payload.count({
    collection: 'users' as const,
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  if (!totalDocs) {
    await payload.create({
      collection: 'users' as const,
      data: devUser,
    })
  }
}
