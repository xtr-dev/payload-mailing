'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface CapturedEmail {
  bcc?: string
  cc?: string
  from?: string
  html?: string
  id: number
  sentAt: string
  subject?: string
  text?: string
  to?: string
}

export default function SentEmailsPage() {
  const [emails, setEmails] = useState<CapturedEmail[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedId, setSelectedId] = useState<null | number>(null)
  const [view, setView] = useState<'html' | 'text'>('html')

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sent-emails', { cache: 'no-store' })
      const data = await res.json()
      const list: CapturedEmail[] = data.emails ?? []
      setEmails(list)
      // Keep a selection if one exists; otherwise default to the newest email.
      setSelectedId((current) =>
        current !== null && list.some((e) => e.id === current) ? current : list[0]?.id ?? null,
      )
    } catch (error) {
      console.error('Error fetching sent emails:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearEmails = useCallback(async () => {
    await fetch('/api/sent-emails', { method: 'DELETE' })
    setSelectedId(null)
    await fetchEmails()
  }, [fetchEmails])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const selected = emails.find((e) => e.id === selectedId) ?? null

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ margin: '0 auto', maxWidth: '1200px' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <Link href="/dashboard" style={{ color: '#3b82f6', fontSize: '0.9rem', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
        </div>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h1 style={{ color: '#1f2937', fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            📬 Sent emails
          </h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={loading}
              onClick={fetchEmails}
              style={{
                backgroundColor: loading ? '#9ca3af' : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                padding: '8px 16px',
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              disabled={emails.length === 0}
              onClick={clearEmails}
              style={{
                backgroundColor: emails.length === 0 ? '#fca5a5' : '#ef4444',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: emails.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                padding: '8px 16px',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>
          Messages captured by the dev test email adapter (no mail is actually delivered). The
          outbox is in-memory and resets when the dev server restarts.
        </p>

        {emails.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              color: '#6b7280',
              padding: '48px',
              textAlign: 'center',
            }}
          >
            No emails sent yet. Create a user or use the{' '}
            <Link href="/mailing-test" style={{ color: '#3b82f6' }}>
              Test interface
            </Link>{' '}
            to send one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '320px 1fr' }}>
            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {emails.map((email) => {
                const active = email.id === selectedId
                return (
                  <button
                    key={email.id}
                    onClick={() => setSelectedId(email.id)}
                    style={{
                      backgroundColor: active ? '#eff6ff' : 'white',
                      border: `1px solid ${active ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        color: '#1f2937',
                        fontWeight: 600,
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {email.subject || '(no subject)'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>To: {email.to || '—'}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      {new Date(email.sentAt).toLocaleString()}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail */}
            <div
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {selected ? (
                <>
                  <div style={{ borderBottom: '1px solid #eef0f2', padding: '20px 24px' }}>
                    <h2 style={{ color: '#1f2937', fontSize: '1.25rem', margin: '0 0 12px' }}>
                      {selected.subject || '(no subject)'}
                    </h2>
                    <dl style={{ display: 'grid', fontSize: '0.85rem', gap: '4px', margin: 0 }}>
                      <MetaRow label="From" value={selected.from} />
                      <MetaRow label="To" value={selected.to} />
                      <MetaRow label="Cc" value={selected.cc} />
                      <MetaRow label="Bcc" value={selected.bcc} />
                      <MetaRow label="Sent" value={new Date(selected.sentAt).toLocaleString()} />
                    </dl>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', padding: '12px 24px' }}>
                    {(['html', 'text'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setView(tab)}
                        style={{
                          backgroundColor: view === tab ? '#1f2937' : '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          color: view === tab ? 'white' : '#374151',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          padding: '6px 14px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: '0 24px 24px' }}>
                    {view === 'html' ? (
                      selected.html ? (
                        // Sandboxed with no allowances: scripts and same-origin
                        // access are disabled, matching the in-admin preview.
                        <iframe
                          sandbox=""
                          srcDoc={selected.html}
                          style={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            height: '70vh',
                            width: '100%',
                          }}
                          title={`Email ${selected.id} HTML`}
                        />
                      ) : (
                        <Empty>No HTML part.</Empty>
                      )
                    ) : selected.text ? (
                      <pre
                        style={{
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: '#1f2937',
                          margin: 0,
                          maxHeight: '70vh',
                          overflow: 'auto',
                          padding: '16px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {selected.text}
                      </pre>
                    ) : (
                      <Empty>No plain-text part.</Empty>
                    )}
                  </div>
                </>
              ) : (
                <Empty>Select an email to view it.</Empty>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#9ca3af', padding: '48px', textAlign: 'center' }}>{children}</div>
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null
  }
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <dt style={{ color: '#9ca3af', minWidth: '48px' }}>{label}</dt>
      <dd style={{ color: '#374151', margin: 0 }}>{value}</dd>
    </div>
  )
}
