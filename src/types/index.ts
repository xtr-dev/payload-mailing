import { Payload } from 'payload'
import { Transporter } from 'nodemailer'

export interface MailingPluginConfig {
  collections?: {
    templates?: string
    outbox?: string
  }
  defaultFrom?: string
  transport?: Transporter | MailingTransportConfig
  queue?: string
  retryAttempts?: number
  retryDelay?: number
}

export interface MailingTransportConfig {
  host: string
  port: number
  secure?: boolean
  auth?: {
    user: string
    pass: string
  }
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlTemplate: string
  textTemplate?: string
  variables?: TemplateVariable[]
  createdAt: string
  updatedAt: string
}

export interface TemplateVariable {
  name: string
  type: 'text' | 'number' | 'boolean' | 'date'
  required: boolean
  description?: string
}

export interface OutboxEmail {
  id: string
  templateId?: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, any>
  scheduledAt?: string
  sentAt?: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  lastAttemptAt?: string
  error?: string
  priority?: number
  createdAt: string
  updatedAt: string
}

export interface SendEmailOptions {
  templateId?: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  replyTo?: string
  subject?: string
  html?: string
  text?: string
  variables?: Record<string, any>
  scheduledAt?: Date
  priority?: number
}

export interface MailingService {
  sendEmail(options: SendEmailOptions): Promise<string>
  scheduleEmail(options: SendEmailOptions): Promise<string>
  processOutbox(): Promise<void>
  retryFailedEmails(): Promise<void>
}

export interface MailingContext {
  payload: Payload
  config: MailingPluginConfig
  service: MailingService
}