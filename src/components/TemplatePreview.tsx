'use client'

import { useAllFormFields, useConfig } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface PreviewResult {
  html: string
  subject: string
  text: string
}

type FormFields = Record<string, { value?: unknown } | undefined>

/**
 * Normalizes the `sampleVariables` form value into a plain object. The JSON
 * field may surface its value as an already-parsed object or as a raw string
 * (e.g. mid-edit), so both are handled; anything invalid falls back to `{}`.
 */
const toVariables = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * In-admin live preview for email templates. Reads the current (unsaved) form
 * content, subject, layout selection and sample variables, then renders them
 * through the plugin's server-side pipeline (`POST <api>/mailing/preview-template`)
 * so the preview honors the configured template engine and selected layout.
 *
 * The HTML output is shown in a sandboxed iframe (scripts disabled) so injected
 * markup cannot execute, and the plain-text alternative is shown in a monospace
 * panel. Renders are debounced as the author edits.
 */
export const TemplatePreview: React.FC = () => {
  const [fields] = useAllFormFields() as unknown as [FormFields, unknown]
  const { config } = useConfig()

  const apiBase = useMemo(() => {
    const serverURL = config?.serverURL || ''
    const apiRoute = config?.routes?.api || '/api'
    return `${serverURL}${apiRoute}`
  }, [config])

  const content = fields?.content?.value
  const subjectValue = fields?.subject?.value
  const subject = typeof subjectValue === 'string' ? subjectValue : ''
  const layoutValue = fields?.layout?.value
  const layout = typeof layoutValue === 'string' ? layoutValue : undefined
  const sampleVariables = fields?.sampleVariables?.value

  // A stable key over the inputs so the debounced effect only re-runs on a real
  // change, not on every unrelated form keystroke.
  const inputKey = useMemo(
    () => JSON.stringify({ content, layout, sampleVariables, subject }),
    [content, layout, sampleVariables, subject],
  )

  const [result, setResult] = useState<null | PreviewResult>(null)
  const [error, setError] = useState<null | string>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'html' | 'text'>('html')
  const abortRef = useRef<AbortController | null>(null)

  const render = useCallback(async () => {
    if (!content) {
      setResult(null)
      setError(null)
      return
    }

    // Cancel any in-flight request so out-of-order responses can't clobber the
    // latest preview.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiBase}/mailing/preview-template`, {
        body: JSON.stringify({
          content,
          layout,
          subject,
          variables: toVariables(sampleVariables),
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Preview failed (${response.status})`)
      }

      setResult((await response.json()) as PreviewResult)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      setError((err as Error).message || 'Failed to render preview')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [apiBase, content, layout, subject, sampleVariables])

  useEffect(() => {
    const timer = setTimeout(render, 400)
    return () => clearTimeout(timer)
    // `render` is recreated whenever its inputs change; `inputKey` captures the
    // same dependency set in a way that's cheap to compare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey])

  // Abort any in-flight preview request when the component unmounts, so a fetch
  // started just before unmount neither lingers nor calls state setters on a
  // gone component.
  useEffect(() => () => abortRef.current?.abort(), [])

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ alignItems: 'center', display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0 }}>Preview</h4>
        {loading && <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Rendering…</span>}
      </div>

      {error && (
        <div
          style={{
            background: 'var(--theme-error-100, #fdecea)',
            border: '1px solid var(--theme-error-250, #f5c6cb)',
            borderRadius: 4,
            color: 'var(--theme-error-600, #842029)',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <strong>Subject:</strong> {result.subject || <em style={{ opacity: 0.6 }}>(empty)</em>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '-1px' }}>
        {(['html', 'text'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            style={{
              background: tab === value ? 'var(--theme-elevation-50, #fff)' : 'transparent',
              border: '1px solid var(--theme-elevation-150, #ddd)',
              borderBottom: tab === value ? '1px solid var(--theme-elevation-50, #fff)' : '1px solid var(--theme-elevation-150, #ddd)',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '0.35rem 0.85rem',
            }}
            type="button"
          >
            {value === 'html' ? 'HTML' : 'Plain text'}
          </button>
        ))}
      </div>

      <div
        style={{
          background: 'var(--theme-elevation-50, #fff)',
          border: '1px solid var(--theme-elevation-150, #ddd)',
          borderRadius: '0 4px 4px 4px',
          minHeight: 200,
          overflow: 'hidden',
        }}
      >
        {tab === 'html' ? (
          <iframe
            // Empty sandbox: render markup but disable scripts, forms and
            // same-origin access so preview content can never execute.
            sandbox=""
            srcDoc={result?.html || '<!-- no content -->'}
            style={{ border: 0, display: 'block', height: 480, width: '100%' }}
            title="Email HTML preview"
          />
        ) : (
          <pre
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.8rem',
              margin: 0,
              maxHeight: 480,
              overflow: 'auto',
              padding: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {result?.text || ''}
          </pre>
        )}
      </div>
    </div>
  )
}

export default TemplatePreview
