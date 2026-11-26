import { describe, expect, test } from 'vitest'

import type { SerializedLinkFields } from './richTextSerializer.js'

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

  test('a resolver returning a javascript: URL still yields href="#"', () => {
    const content = state(
      paragraph(payloadLink('link', { doc: { relationTo: 'pages', value: '1' }, linkType: 'internal' }, 'About')),
    )
    const html = serializeRichTextToHTML(content, { resolveInternalLink: () => 'javascript:alert(1)' })
    expect(html).toBe('<p><a href="#">About</a></p>')
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
      { templateSyntax: 'liquid' },
    )
    expect(html).toBe('<p>a&lt;b {% if n > 5 %}x{% endif %} {{- n | minus: 1 -}} c&amp;d</p>')
  })

  test('a tag split across differently formatted text nodes is escaped (documented limitation)', () => {
    // format 1 = bold. The split puts <strong> inside the tag, which no engine
    // can parse; the fragments are escaped like ordinary text.
    const html = serializeRichTextToHTML(
      state(paragraph(textNode('{% if n '), textNode('> 5 %}', 1), textNode('x{% endif %}'))),
      { templateSyntax: 'liquid' },
    )
    expect(html).toBe('<p>{% if n <strong>&gt; 5 %}</strong>x{% endif %}</p>')
  })

  test('passthrough depends on the engine syntax', () => {
    const content = state(paragraph(textNode('{% if n > 5 %} {{ n > 5 }}')))
    expect(serializeRichTextToHTML(content, { templateSyntax: 'liquid' })).toBe('<p>{% if n > 5 %} {{ n > 5 }}</p>')
    expect(serializeRichTextToHTML(content, { templateSyntax: 'mustache' })).toBe(
      '<p>{% if n &gt; 5 %} {{ n > 5 }}</p>',
    )
    expect(serializeRichTextToHTML(content)).toBe('<p>{% if n &gt; 5 %} {{ n &gt; 5 }}</p>')
  })
})

describe('Payload 3 link nodes with template-tag passthrough', () => {
  test('a Liquid tag in the link text passes through; the text around it is escaped', () => {
    const content = state(paragraph(payloadLink('link', { url: 'https://x.test' }, 'Hi {{ name }} & <b>')))
    expect(serializeRichTextToHTML(content, { templateSyntax: 'liquid' })).toBe(
      '<p><a href="https://x.test">Hi {{ name }} &amp; &lt;b&gt;</a></p>',
    )
  })

  test('a link URL with quotes is escaped in the href in both serializations', () => {
    const content = state(paragraph(payloadLink('link', { url: `https://x.test/?q="a"&b='c'` }, 'go')))
    const expected = '<p><a href="https://x.test/?q=&quot;a&quot;&amp;b=&#39;c&#39;">go</a></p>'
    expect(serializeRichTextToHTML(content, { templateSyntax: 'liquid' })).toBe(expected)
    expect(serializeRichTextToHTML(content)).toBe(expected)
  })

  test('the fully escaped serialization renders fields.url, autolink and internal links', () => {
    const content = state(
      paragraph(
        payloadLink('link', { newTab: true, url: 'https://a.test' }, 'A'),
        payloadLink('autolink', { url: 'https://b.test' }, 'https://b.test'),
        payloadLink('link', { doc: { relationTo: 'pages', value: '1' }, linkType: 'internal' }, 'C'),
      ),
    )
    const html = serializeRichTextToHTML(content, { resolveInternalLink: () => '/pages/1' })
    expect(html).toBe(
      '<p><a href="https://a.test" target="_blank" rel="noopener noreferrer">A</a>' +
        '<a href="https://b.test">https://b.test</a><a href="/pages/1">C</a></p>',
    )
  })
})
