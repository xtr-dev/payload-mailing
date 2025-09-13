import { Payload } from 'payload'
import { SendEmailOptions } from '../types/index.js'

export const getMailing = (payload: Payload) => {
  const mailing = (payload as any).mailing
  if (!mailing) {
    throw new Error('Mailing plugin not initialized. Make sure you have added the mailingPlugin to your Payload config.')
  }
  return mailing
}

export const sendEmail = async (payload: Payload, options: SendEmailOptions): Promise<string> => {
  const mailing = getMailing(payload)
  return mailing.service.sendEmail(options)
}

export const scheduleEmail = async (payload: Payload, options: SendEmailOptions): Promise<string> => {
  const mailing = getMailing(payload)
  return mailing.service.scheduleEmail(options)
}

export const processEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.processEmails()
}

export const retryFailedEmails = async (payload: Payload): Promise<void> => {
  const mailing = getMailing(payload)
  return mailing.service.retryFailedEmails()
}