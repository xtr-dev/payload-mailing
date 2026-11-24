import { describe, expect, test } from 'vitest'

import { escapeHtml as entryEscapeHtml, safeUrl as entrySafeUrl } from '../index.js'
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
  test('escapes single quotes so values are safe in single-quoted attributes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

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
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; "quotes"</p>',
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

describe('package exports', () => {
  test('escapeHtml and safeUrl are exported from the package entry', () => {
    expect(entryEscapeHtml).toBe(escapeHtml)
    expect(entrySafeUrl).toBe(safeUrl)
  })
})

describe('serializeRichTextToHTML — template tags in text nodes', () => {
  test('leaves complete tags verbatim and escapes the text around them', () => {
    const html = serializeRichTextToHTML(
      state(paragraph(textNode('a<b {% if n > 5 %}x{% endif %} {{- n | minus: 1 -}} c&d'))),
    )
    expect(html).toBe('<p>a&lt;b {% if n > 5 %}x{% endif %} {{- n | minus: 1 -}} c&amp;d</p>')
  })

  test('a tag split across differently formatted text nodes is escaped (documented limitation)', () => {
    // format 1 = bold. The split puts <strong> inside the tag, which no engine
    // can parse; the fragments are escaped like ordinary text.
    const html = serializeRichTextToHTML(
      state(paragraph(textNode('{% if n '), textNode('> 5 %}', 1), textNode('x{% endif %}'))),
    )
    expect(html).toBe('<p>{% if n <strong>&gt; 5 %}</strong>x{% endif %}</p>')
  })
})

