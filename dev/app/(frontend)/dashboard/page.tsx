'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EmailStats {
  total: number
  sent: number
  pending: number
  failed: number
  processing: number
}

export default function HomePage() {
  const [emailStats, setEmailStats] = useState<EmailStats>({
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
    processing: 0
  })
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchEmailStats()
  }, [])

  const fetchEmailStats = async () => {
    try {
      const response = await fetch('/api/test-email')
      const data = await response.json()

      if (data.outbox?.emails) {
        const emails = data.outbox.emails
        const stats: EmailStats = {
          total: emails.length,
          sent: emails.filter((email: any) => email.status === 'sent').length,
          pending: emails.filter((email: any) => email.status === 'pending').length,
          failed: emails.filter((email: any) => email.status === 'failed').length,
          processing: emails.filter((email: any) => email.status === 'processing').length
        }
        setEmailStats(stats)
      }
    } catch (error) {
      console.error('Error fetching email statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ label, value, color, description }: { label: string; value: number; color: string; description: string }) => (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '24px',
      textAlign: 'center',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        color: color,
        marginBottom: '8px'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '4px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        {description}
      </div>
    </div>
  )

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      padding: '40px 20px',
      minHeight: 'calc(100vh - 80px)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            📧 PayloadCMS Mailing Plugin
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: '#6b7280',
            marginBottom: '24px'
          }}>
            Development Dashboard
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/admin"
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
            >
              📊 Admin Panel
            </Link>
            <Link
              href="/mailing-test"
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
            >
              🧪 Test Interface
            </Link>
          </div>
        </div>

        {/* Email Statistics */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              Email Statistics
            </h2>
            <button
              onClick={fetchEmailStats}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#9ca3af' : '#6b7280',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#6b7280', fontSize: '1.1rem' }}>Loading email statistics...</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px'
            }}>
              <StatCard
                label="Total Emails"
                value={emailStats.total}
                color="#1f2937"
                description="All emails in the system"
              />
              <StatCard
                label="Successfully Sent"
                value={emailStats.sent}
                color="#10b981"
                description="Delivered successfully"
              />
              <StatCard
                label="Pending"
                value={emailStats.pending}
                color="#f59e0b"
                description="Waiting to be sent"
              />
              <StatCard
                label="Failed"
                value={emailStats.failed}
                color="#ef4444"
                description="Failed to send"
              />
              {emailStats.processing > 0 && (
                <StatCard
                  label="Processing"
                  value={emailStats.processing}
                  color="#3b82f6"
                  description="Currently being sent"
                />
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            Quick Actions
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '8px', color: '#1f2937' }}>🎯 Test Email Sending</h4>
              <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '0.9rem' }}>
                Send test emails using templates with the interactive testing interface.
              </p>
              <Link
                href="/mailing-test"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                Open Test Interface →
              </Link>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '8px', color: '#1f2937' }}>📝 Manage Templates</h4>
              <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '0.9rem' }}>
                Create and edit email templates in the Payload admin interface.
              </p>
              <Link
                href="/admin/collections/email-templates"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                Manage Templates →
              </Link>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '8px', color: '#1f2937' }}>📬 Email Queue</h4>
              <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '0.9rem' }}>
                View and manage the email outbox and delivery status.
              </p>
              <Link
                href="/admin/collections/emails"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                View Email Queue →
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '48px',
          padding: '24px',
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          PayloadCMS Mailing Plugin Development Environment
        </div>
      </div>
    </div>
  )
}