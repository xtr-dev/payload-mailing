'use client'

import { useState, useEffect } from 'react'

interface Template {
  id: string
  name: string
  slug: string
  subject: string
  variables?: Array<{
    name: string
    type: string
    required: boolean
    description?: string
  }>
  previewData?: Record<string, any>
}

interface QueuedEmail {
  id: string
  subject: string
  to: string[]
  status: string
  createdAt: string
  sentAt?: string
  attempts: number
  error?: string
}

export default function MailingTestPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [queuedEmails, setQueuedEmails] = useState<QueuedEmail[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [toEmail, setToEmail] = useState<string>('test@example.com')
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [jsonVariables, setJsonVariables] = useState<string>('{}')
  const [jsonError, setJsonError] = useState<string>('')
  const [emailType, setEmailType] = useState<'send' | 'schedule'>('send')
  const [scheduleDate, setScheduleDate] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/test-email')
      const data = await response.json()
      setTemplates(data.templates || [])
      setQueuedEmails(data.outbox?.emails || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleTemplateChange = (templateSlug: string) => {
    setSelectedTemplate(templateSlug)
    const template = templates.find(t => t.slug === templateSlug)
    if (template?.previewData) {
      setVariables(template.previewData)
      setJsonVariables(JSON.stringify(template.previewData, null, 2))
    } else {
      setVariables({})
      setJsonVariables('{}')
    }
    setJsonError('')
  }

  const handleJsonVariablesChange = (jsonString: string) => {
    setJsonVariables(jsonString)
    setJsonError('')

    try {
      const parsed = JSON.parse(jsonString)
      setVariables(parsed)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON')
    }
  }

  const sendTestEmail = async () => {
    if (!selectedTemplate || !toEmail) {
      setMessage('Please select a template and enter an email address')
      return
    }

    if (jsonError) {
      setMessage('Please fix the JSON syntax error before sending')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: emailType,
          templateSlug: selectedTemplate,
          to: toEmail,
          variables,
          scheduledAt: emailType === 'schedule' ? scheduleDate : undefined,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const statusIcon = result.status === 'sent' ? '📧' : '📫'
        setMessage(`✅ ${statusIcon} ${result.message} (ID: ${result.emailId})`)
        fetchData() // Refresh email queue
      } else {
        setMessage(`❌ Error: ${result.error}`)
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const processEmailQueue = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/process-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      setMessage(result.success ? `✅ ${result.message}` : `❌ ${result.error}`)
      
      setTimeout(() => {
        fetchData() // Refresh after a delay to see status changes
      }, 1000)
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedTemplateData = templates.find(t => t.slug === selectedTemplate)

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>📧 PayloadCMS Mailing Plugin Test</h1>
      
      {message && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          backgroundColor: message.startsWith('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Send Email Form */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h2>Send Test Email</h2>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Email Template:</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Select a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.slug}>{template.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>To Email:</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Type:</label>
            <label style={{ marginRight: '15px' }}>
              <input
                type="radio"
                value="send"
                checked={emailType === 'send'}
                onChange={(e) => setEmailType(e.target.value as 'send' | 'schedule')}
              />
              Send Now
            </label>
            <label>
              <input
                type="radio"
                value="schedule"
                checked={emailType === 'schedule'}
                onChange={(e) => setEmailType(e.target.value as 'send' | 'schedule')}
              />
              Schedule
            </label>
          </div>

          {emailType === 'schedule' && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Schedule Date:</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          )}

          {selectedTemplate && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <strong>Template Variables (JSON):</strong>
                {selectedTemplateData?.variables && (
                  <small style={{ color: '#666', marginLeft: '8px' }}>
                    Available variables: {selectedTemplateData.variables.map(v => v.name).join(', ')}
                  </small>
                )}
              </label>
              <textarea
                value={jsonVariables}
                onChange={(e) => handleJsonVariablesChange(e.target.value)}
                placeholder='{\n  "firstName": "John",\n  "siteName": "MyApp",\n  "createdAt": "2023-01-01T00:00:00Z"\n}'
                style={{
                  width: '100%',
                  height: '150px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: jsonError ? '2px solid #dc3545' : '1px solid #ddd',
                  fontFamily: 'monaco, "Courier New", monospace',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
              {jsonError && (
                <div style={{
                  color: '#dc3545',
                  fontSize: '12px',
                  marginTop: '5px',
                  padding: '5px',
                  backgroundColor: '#f8d7da',
                  borderRadius: '4px'
                }}>
                  Invalid JSON: {jsonError}
                </div>
              )}
            </div>
          )}

          <button
            onClick={sendTestEmail}
            disabled={loading || !selectedTemplate || !toEmail}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
            }}
          >
            {loading ? 'Sending...' : emailType === 'send' ? 'Send Email' : 'Schedule Email'}
          </button>

          <button
            onClick={processEmailQueue}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px',
            }}
          >
            {loading ? 'Queuing...' : 'Process Email Queue (Pending + Failed)'}
          </button>
        </div>

        {/* Email Queue */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>Email Queue</h2>
            <button
              onClick={fetchData}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          {queuedEmails.length === 0 ? (
            <p style={{ color: '#666' }}>No emails in queue</p>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {queuedEmails.map(email => (
                <div
                  key={email.id}
                  style={{
                    border: '1px solid #eee',
                    padding: '12px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    backgroundColor: email.status === 'sent' ? '#f8f9fa' : 
                                   email.status === 'failed' ? '#fff3cd' : 
                                   email.status === 'processing' ? '#e3f2fd' : 'white',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{email.subject}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    To: {Array.isArray(email.to) ? email.to.join(', ') : email.to} | Status: <strong>{email.status}</strong> | Attempts: {email.attempts}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    Created: {new Date(email.createdAt).toLocaleString()}
                    {email.sentAt && ` | Sent: ${new Date(email.sentAt).toLocaleString()}`}
                  </div>
                  {email.error && (
                    <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '5px' }}>
                      Error: {email.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Templates Overview */}
      <div style={{ marginTop: '30px', border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
        <h2>Available Templates</h2>
        {templates.length === 0 ? (
          <p style={{ color: '#666' }}>No templates available</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            {templates.map(template => (
              <div key={template.id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>{template.name}</h3>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{template.subject}</p>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Variables: {template.variables?.length || 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}