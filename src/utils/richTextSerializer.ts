// Proper type definitions for Lexical serialization
interface SerializedEditorState {
  root: {
    children: SerializedLexicalNode[]
  }
}

interface SerializedLexicalNode {
  children?: SerializedLexicalNode[]
  format?: number
  listType?: 'bullet' | 'number'
  newTab?: boolean
  tag?: string
  text?: string
  type: string
  url?: string
}

/**
 * Escapes HTML-significant characters (`& < > " '`) to prevent HTML injection in
 * serialized output, including inside single- or double-quoted attributes.
 * Exported so the rendering pipeline can reuse the exact same escaping when it
 * substitutes template variables into the HTML body (see MailingService).
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escapes text that becomes element content (not an attribute value): only
 * `&`, `<` and `>` need escaping there. Quotes are left alone on purpose: the
 * serialized HTML body is template source that LiquidJS parses afterwards,
 * and escaped quotes would break quoted arguments such as
 * `{{ d | formatDate: "long" }}` or `{% if s == 'paid' %}`. Values substituted
 * by the template engine are still escaped by the engine itself.
 */
function escapeTextContent(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// A complete template tag inside one text node: a Liquid tag `{% … %}` or an
// output `{{ … }}`, including the whitespace-control forms `{%- -%}` and
// `{{- -}}` (the `-` sits inside the delimiters, so it is covered by `[\s\S]*?`).
const TEMPLATE_TAG = /\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g

/**
 * Escapes a text node for the HTML body while leaving template tags intact.
 *
 * The HTML body is template source that the engine parses after
 * serialization, so the inside of a tag must reach it verbatim: `{% if n > 5 %}`
 * becomes invalid Liquid once `>` is turned into `&gt;`. Text outside the tags
 * is escaped as usual, so literal `<b>` typed in the editor stays text. Output
 * values are still escaped by the engine at render time.
 *
 * Limitation: only tags that sit wholly inside one text node are recognised.
 * Lexical splits text into separate nodes only where the formatting changes,
 * and a tag spanning such a split would contain formatting markup (e.g.
 * `<strong>`) that no engine can parse anyway; its text is escaped as usual.
 */
function escapeTextNode(input: string): string {
  let out = ''
  let last = 0
  for (const match of input.matchAll(TEMPLATE_TAG)) {
    out += escapeTextContent(input.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }
  return out + escapeTextContent(input.slice(last))
}

/**
 * Allow-lists safe URL schemes (http, https, mailto) plus relative/anchor URLs,
 * escapes the result, and returns '#' for anything else (e.g. javascript:).
 */
export function safeUrl(rawUrl: string): string {
  const url = (rawUrl || '#').trim()
  if (/^(?:https?:|mailto:)/i.test(url) || /^[^a-z]/i.test(url)) {
    return escapeHtml(url)
  }
  return '#'
}

/**
 * Converts Lexical richtext content to HTML
 */
export function serializeRichTextToHTML(richTextData: SerializedEditorState): string {
  if (!richTextData?.root?.children) {
    return ''
  }

  return serializeNodesToHTML(richTextData.root.children)
}

/**
 * Converts Lexical richtext content to plain text
 */
export function serializeRichTextToText(richTextData: SerializedEditorState): string {
  if (!richTextData?.root?.children) {
    return ''
  }

  return serializeNodesToText(richTextData.root.children)
}

function serializeNodesToHTML(nodes: SerializedLexicalNode[]): string {
  return nodes.map(node => serializeNodeToHTML(node)).join('')
}

function serializeNodeToHTML(node: SerializedLexicalNode): string {
  if (!node) {return ''}

  switch (node.type) {
    case 'heading': {
      const headingChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const tag = node.tag || 'h1'
      return `<${tag}>${headingChildren}</${tag}>`
    }

    case 'horizontalrule':
      return '<hr>'

    case 'linebreak':
      return '<br>'

    case 'link': {
      const linkChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const url = safeUrl(node.url || '#')
      const target = node.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${url}"${target}>${linkChildren}</a>`
    }

    case 'list': {
      const listChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${listTag}>${listChildren}</${listTag}>`
    }

    case 'listitem': {
      const listItemChildren = node.children ? serializeNodesToHTML(node.children) : ''
      return `<li>${listItemChildren}</li>`
    }

    case 'paragraph': {
      const children = node.children ? serializeNodesToHTML(node.children) : ''
      return `<p>${children}</p>`
    }

    case 'quote': {
      const quoteChildren = node.children ? serializeNodesToHTML(node.children) : ''
      return `<blockquote>${quoteChildren}</blockquote>`
    }

    case 'text': {
      let text = escapeTextNode(node.text || '')

      // Apply text formatting using proper nesting order
      if (node.format) {
        const formatFlags = {
          bold: (node.format & 1) !== 0,
          code: (node.format & 16) !== 0,
          italic: (node.format & 2) !== 0,
          strikethrough: (node.format & 4) !== 0,
          underline: (node.format & 8) !== 0,
        }

        // Apply formatting in proper nesting order: code > bold > italic > underline > strikethrough
        if (formatFlags.code) {text = `<code>${text}</code>`}
        if (formatFlags.bold) {text = `<strong>${text}</strong>`}
        if (formatFlags.italic) {text = `<em>${text}</em>`}
        if (formatFlags.underline) {text = `<u>${text}</u>`}
        if (formatFlags.strikethrough) {text = `<s>${text}</s>`}
      }

      return text
    }

    default:
      // Handle unknown nodes by processing children
      if (node.children) {
        return serializeNodesToHTML(node.children)
      }
      return ''
  }
}

function serializeNodesToText(nodes: SerializedLexicalNode[]): string {
  return nodes.map(node => serializeNodeToText(node)).join('')
}

function serializeNodeToText(node: SerializedLexicalNode): string {
  if (!node) {return ''}

  switch (node.type) {
    case 'heading': {
      const headingChildren = node.children ? serializeNodesToText(node.children) : ''
      return `${headingChildren}\n\n`
    }

    case 'horizontalrule':
      return '---\n\n'

    case 'linebreak':
      return '\n'

    case 'link': {
      const linkChildren = node.children ? serializeNodesToText(node.children) : ''
      const url = node.url || ''
      return `${linkChildren} (${url})`
    }

    case 'list': {
      const listChildren = node.children ? serializeNodesToText(node.children) : ''
      return `${listChildren}\n`
    }

    case 'listitem': {
      const listItemChildren = node.children ? serializeNodesToText(node.children) : ''
      return `• ${listItemChildren}\n`
    }

    case 'paragraph': {
      const children = node.children ? serializeNodesToText(node.children) : ''
      return `${children}\n\n`
    }

    case 'quote': {
      const quoteChildren = node.children ? serializeNodesToText(node.children) : ''
      return `> ${quoteChildren}\n\n`
    }

    case 'text':
      return node.text || ''

    default:
      // Handle unknown nodes by processing children
      if (node.children) {
        return serializeNodesToText(node.children)
      }
      return ''
  }
}
