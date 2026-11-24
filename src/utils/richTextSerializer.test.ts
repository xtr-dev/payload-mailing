import { describe, expect, test } from 'vitest'

import type { SerializedLinkFields } from './richTextSerializer.js'

import {
  escapeHtml,
  safeUrl,
  serializeRichTextToHTML,
  serializeRichTextToText,
} from './richTextSerializer.js'

// Minimal Lexical editor-state builders for the serializer under test.
const paragraph = (...children: any[]) => ({ type: 'paragraph', children })
const textNode = (text: string, format = 0) => ({ type: 'text', format, text })
const linkNode = (url: string, text: string) => ({
  type: 'link',
  children: [textNode(text)],
  url,
})
const state = (...children: any[]) => ({ root: { children } }) as any

describe('escapeHtml', () => {
  test('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<b>Tom & "Jerry"</b>')).toBe(
      '&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;',
    )
  })

  test('escapes ampersands before other entities (no double-escaping)', () => {
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c')
  })

  test('leaves safe text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('safeUrl', () => {
  test('allows http, https and mailto schemes', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com')
    expect(safeUrl('http://example.com')).toBe('http://example.com')
    expect(safeUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com')
  })

  test('allows relative and anchor URLs', () => {
    expect(safeUrl('/path/to/page')).toBe('/path/to/page')
    expect(safeUrl('#section')).toBe('#section')
  })

  test('rejects javascript: and other dangerous schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#')
    expect(safeUrl('JavaScript:alert(1)')).toBe('#')
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#')
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#')
  })

  test('escapes quotes to prevent attribute break-out', () => {
    expect(safeUrl('https://x.com" onmouseover="alert(1)')).toBe(
      'https://x.com&quot; onmouseover=&quot;alert(1)',
    )
  })
})

describe('serializeRichTextToHTML', () => {
  test('escapes text node content', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(textNode('<script>alert(1)</script> & "quotes"'))),
    )
    expect(html).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;</p>',
    )
  })

  test('escapes text inside formatting tags without escaping the tags', () => {
    // format 1 = bold
    const html = serializeRichTextToHTML(state(paragraph(textNode('<x>', 1))))
    expect(html).toBe('<p><strong>&lt;x&gt;</strong></p>')
  })

  test('runs a safe link URL through unchanged', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(linkNode('https://example.com', 'click'))),
    )
    expect(html).toBe('<p><a href="https://example.com">click</a></p>')
  })

  test('neutralizes a javascript: link URL', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(linkNode('javascript:alert(1)', 'click'))),
    )
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('prevents href attribute break-out via an unescaped quote', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(linkNode('https://x.com" onmouseover="alert(1)', 'click'))),
    )
    expect(html).not.toContain('" onmouseover="')
    expect(html).toContain('&quot;')
  })
})

describe('serializeRichTextToText', () => {
  test('does not HTML-escape plain text output', () => {
    // Plain-text emails must keep literal characters; escaping would surface
    // as visible entities (e.g. `&amp;`) to recipients.
    const text = serializeRichTextToText(state(paragraph(textNode('Tom & <Jerry>'))))
    expect(text).toContain('Tom & <Jerry>')
    expect(text).not.toContain('&amp;')
  })
})

// Payload 3's Lexical LinkNode/AutoLinkNode export their URL under `fields`.
const payloadLink = (
  type: 'autolink' | 'link',
  fields: Record<string, unknown>,
  text: string,
) => ({ type, children: [textNode(text)], fields })

describe('Payload 3 link nodes (url under node.fields)', () => {
  test('reads fields.url and fields.newTab for a custom link', () => {
    const content = state(
      paragraph(payloadLink('link', { linkType: 'custom', newTab: true, url: 'https://example.com' }, 'click')),
    )
    expect(serializeRichTextToHTML(content)).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">click</a></p>',
    )
    expect(serializeRichTextToText(content)).toContain('click (https://example.com)')
  })

  test('still neutralizes a dangerous fields.url', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(payloadLink('link', { linkType: 'custom', url: 'javascript:alert(1)' }, 'x'))),
    )
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('renders autolink nodes as links without repeating the URL in text', () => {
    const content = state(
      paragraph(payloadLink('autolink', { linkType: 'custom', url: 'https://example.com' }, 'https://example.com')),
    )
    expect(serializeRichTextToHTML(content)).toBe(
      '<p><a href="https://example.com">https://example.com</a></p>',
    )
    expect(serializeRichTextToText(content).trim()).toBe('https://example.com')
  })

  test('resolves internal links through resolveInternalLink', () => {
    const fields = {
      doc: { relationTo: 'pages', value: { id: '1', slug: 'about' } },
      linkType: 'internal',
    }
    const content = state(paragraph(payloadLink('link', fields, 'About')))
    const resolveInternalLink = (f: SerializedLinkFields) =>
      `https://site.test/${(f.doc?.value as { slug: string }).slug}`

    expect(serializeRichTextToHTML(content, { resolveInternalLink })).toBe(
      '<p><a href="https://site.test/about">About</a></p>',
    )
    expect(serializeRichTextToText(content, { resolveInternalLink })).toContain(
      'About (https://site.test/about)',
    )
  })

  test('renders an unresolved internal link as plain text, not href="#"', () => {
    const content = state(
      paragraph(payloadLink('link', { doc: { relationTo: 'pages', value: '1' }, linkType: 'internal' }, 'About')),
    )
    expect(serializeRichTextToHTML(content)).toBe('<p>About</p>')
    expect(serializeRichTextToText(content)).not.toContain('()')
  })
})
