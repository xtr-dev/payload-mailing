// Proper type definitions for Lexical serialization
interface SerializedEditorState {
  root: {
    children: SerializedLexicalNode[]
  }
}

/**
 * Link data as Payload 3's Lexical `LinkNode` / `AutoLinkNode` export it: the
 * URL and options live under `node.fields`, not on the node itself.
 */
export interface SerializedLinkFields {
  /** For internal links: the linked document, populated or just its ID. */
  doc?: {
    relationTo: string
    value: unknown
  } | null
  linkType?: 'custom' | 'internal'
  newTab?: boolean
  url?: string
}

interface SerializedLexicalNode {
  children?: SerializedLexicalNode[]
  fields?: SerializedLinkFields
  format?: number
  listType?: 'bullet' | 'number'
  // Legacy/hand-built shape: link options stored directly on the node.
  newTab?: boolean
  tag?: string
  text?: string
  type: string
  url?: string
}

/**
 * Turns an internal link (a link to another Payload document) into a URL.
 * Receives the link's `fields`; `fields.doc.value` is the linked document when
 * the template was fetched with enough depth, otherwise just its ID. Return
 * `undefined`/`null` when the link cannot be resolved — it is then rendered as
 * plain text instead of a dead `href="#"` link.
 */
export type InternalLinkResolver = (fields: SerializedLinkFields) => null | string | undefined

export interface RichTextSerializeOptions {
  resolveInternalLink?: InternalLinkResolver
  /**
   * HTML only: which template tags in text nodes are left unescaped for the
   * engine (see {@link TemplateTagSyntax}). Defaults to `'none'`.
   */
  templateSyntax?: TemplateTagSyntax
}

/**
 * Reads the URL and new-tab flag of a `link` / `autolink` node, supporting both
 * Payload 3's `node.fields` shape and the older flat `node.url` shape. Internal
 * links are resolved through `options.resolveInternalLink`. Returns an empty
 * URL when the link has no usable target.
 */
function getLinkTarget(
  node: SerializedLexicalNode,
  options: RichTextSerializeOptions,
): { newTab: boolean; url: string } {
  const fields = node.fields
  const newTab = Boolean(fields?.newTab ?? node.newTab)

  let url: null | string | undefined
  if (fields?.linkType === 'internal') {
    url = options.resolveInternalLink?.(fields)
  } else {
    url = fields?.url ?? node.url
  }

  return { newTab, url: typeof url === 'string' ? decodeTemplateTagsInUrl(url.trim()) : '' }
}

// `%7B%7B` is an encoded `{{`, `%7B%25` an encoded `{%`.
const ENCODED_TAG_OPENER = /%7B(?:%7B|%25)/i

/**
 * Restores template tags that Lexical percent-encoded in a link URL.
 *
 * Lexical's link field runs `encodeURIComponent` over the whole URL whenever it
 * fails Lexical's own URL validation, which every URL starting with a template
 * tag does (`{{siteUrl}}/account` is stored as `%7B%7BsiteUrl%7D%7D%2Faccount`).
 * Because the whole string was encoded, decoding the whole string recovers
 * exactly what the editor typed. URLs without an encoded tag opener are
 * returned unchanged, so ordinary percent-encoded URLs keep their encoding.
 */
export function decodeTemplateTagsInUrl(url: string): string {
  if (!ENCODED_TAG_OPENER.test(url)) {return url}
  try {
    return decodeURIComponent(url)
  } catch {
    // Malformed escape sequences mean this was not Lexical's encoding.
    return url
  }
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

/**
 * Which template tags the serializer leaves unescaped in text nodes, matching
 * the engine that renders the HTML body afterwards:
 * - `'liquid'`: Liquid tags `{% … %}` and outputs `{{ … }}`
 * - `'mustache'`: Mustache tags `{{ … }}` only (`{%` means nothing to Mustache)
 * - `'none'` (default): no passthrough, every character is escaped
 */
export type TemplateTagSyntax = 'liquid' | 'mustache' | 'none'

// One complete tag inside a single text node, matched non-greedily so it ends
// at the first closer. Whitespace-control forms (`{%- -%}`, `{{- -}}`) are
// covered because the `-` sits inside the delimiters.
const TAG_PATTERNS: Record<Exclude<TemplateTagSyntax, 'none'>, RegExp> = {
  liquid: /\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g,
  mustache: /\{\{[\s\S]*?\}\}/g,
}

/**
 * Escapes a text node for the HTML body while leaving the engine's template
 * tags intact.
 *
 * The HTML body is template source that the engine parses after
 * serialization, so the inside of a tag must reach it verbatim: `{% if n > 5 %}`
 * becomes invalid Liquid once `>` is turned into `&gt;`. Text outside the tags
 * is escaped as usual, so literal `<b>` typed in the editor stays text. Output
 * values are still escaped by the engine at render time.
 *
 * Safety: passed-through tag contents are only safe because the engine parses
 * them. When a tag does not parse (e.g. `{{ <img onerror=…> }}`), the engine
 * adapters render a fully escaped serialization (`syntax: 'none'`) instead, so
 * markup inside a broken tag is never sent raw.
 *
 * Limitation: only tags that sit wholly inside one text node are recognised.
 * Lexical splits text into separate nodes only where the formatting changes,
 * and a tag spanning such a split would contain formatting markup (e.g.
 * `<strong>`) that no engine can parse anyway; its text is escaped as usual.
 */
function escapeTextNode(input: string, syntax: TemplateTagSyntax): string {
  return escapeOutsideTags(input, syntax, escapeTextContent)
}

/**
 * Applies `escape` to everything in `input` except the engine's template tags,
 * which are passed through verbatim (see {@link escapeTextNode} for why that is
 * safe). With `syntax: 'none'` the whole input is escaped.
 */
function escapeOutsideTags(input: string, syntax: TemplateTagSyntax, escape: (s: string) => string): string {
  if (syntax === 'none') {
    return escape(input)
  }
  let out = ''
  let last = 0
  for (const match of input.matchAll(TAG_PATTERNS[syntax])) {
    out += escape(input.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }
  return out + escape(input.slice(last))
}

/**
 * Allow-lists safe URL schemes (http, https, mailto) plus relative/anchor URLs,
 * escapes the result, and returns '#' for anything else (e.g. javascript:).
 */
export function safeUrl(rawUrl: string): string {
  return safeTemplateUrl(rawUrl, 'none')
}

/**
 * {@link safeUrl} for a link in the HTML body, which is template source: the
 * engine's tags (e.g. `{{resetUrl}}` or `{{ url | append: "/x" }}`) are left
 * unescaped so the engine can parse them, and everything else is
 * attribute-escaped. The scheme allow-list applies to the URL as written, so a
 * URL that starts with a tag passes as relative and the scheme of the value
 * substituted into it is not checked.
 */
function safeTemplateUrl(rawUrl: string, syntax: TemplateTagSyntax): string {
  const url = (rawUrl || '#').trim()
  if (/^(?:https?:|mailto:)/i.test(url) || /^[^a-z]/i.test(url)) {
    return escapeOutsideTags(url, syntax, escapeHtml)
  }
  return '#'
}

/**
 * Converts Lexical richtext content to HTML
 */
export function serializeRichTextToHTML(
  richTextData: SerializedEditorState,
  options: RichTextSerializeOptions = {},
): string {
  if (!richTextData?.root?.children) {
    return ''
  }

  return serializeNodesToHTML(richTextData.root.children, options)
}

/**
 * Converts Lexical richtext content to plain text
 */
export function serializeRichTextToText(
  richTextData: SerializedEditorState,
  options: RichTextSerializeOptions = {},
): string {
  if (!richTextData?.root?.children) {
    return ''
  }

  return serializeNodesToText(richTextData.root.children, options)
}

function serializeNodesToHTML(nodes: SerializedLexicalNode[], options: RichTextSerializeOptions): string {
  return nodes.map(node => serializeNodeToHTML(node, options)).join('')
}

function serializeNodeToHTML(node: SerializedLexicalNode, options: RichTextSerializeOptions): string {
  if (!node) {return ''}

  switch (node.type) {
    case 'autolink':
    case 'link': {
      const linkChildren = node.children ? serializeNodesToHTML(node.children, options) : ''
      const { newTab, url } = getLinkTarget(node, options)
      // A link without a target (e.g. an unresolved internal link) keeps its
      // text but drops the anchor rather than pointing at a dead `#`.
      if (!url) {return linkChildren}
      const target = newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${safeTemplateUrl(url, options.templateSyntax || 'none')}"${target}>${linkChildren}</a>`
    }

    case 'heading': {
      const headingChildren = node.children ? serializeNodesToHTML(node.children, options) : ''
      const tag = node.tag || 'h1'
      return `<${tag}>${headingChildren}</${tag}>`
    }

    case 'horizontalrule':
      return '<hr>'

    case 'linebreak':
      return '<br>'

    case 'list': {
      const listChildren = node.children ? serializeNodesToHTML(node.children, options) : ''
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${listTag}>${listChildren}</${listTag}>`
    }

    case 'listitem': {
      const listItemChildren = node.children ? serializeNodesToHTML(node.children, options) : ''
      return `<li>${listItemChildren}</li>`
    }

    case 'paragraph': {
      const children = node.children ? serializeNodesToHTML(node.children, options) : ''
      return `<p>${children}</p>`
    }

    case 'quote': {
      const quoteChildren = node.children ? serializeNodesToHTML(node.children, options) : ''
      return `<blockquote>${quoteChildren}</blockquote>`
    }

    case 'text': {
      let text = escapeTextNode(node.text || '', options.templateSyntax || 'none')

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
        return serializeNodesToHTML(node.children, options)
      }
      return ''
  }
}

function serializeNodesToText(nodes: SerializedLexicalNode[], options: RichTextSerializeOptions): string {
  return nodes.map(node => serializeNodeToText(node, options)).join('')
}

function serializeNodeToText(node: SerializedLexicalNode, options: RichTextSerializeOptions): string {
  if (!node) {return ''}

  switch (node.type) {
    case 'autolink':
    case 'link': {
      const linkChildren = node.children ? serializeNodesToText(node.children, options) : ''
      const { url } = getLinkTarget(node, options)
      // No target: keep only the text instead of an empty ` ()`. When the link
      // text already is the URL (typical for autolinks), don't repeat it.
      if (!url || linkChildren.trim() === url) {return linkChildren}
      return `${linkChildren} (${url})`
    }

    case 'heading': {
      const headingChildren = node.children ? serializeNodesToText(node.children, options) : ''
      return `${headingChildren}\n\n`
    }

    case 'horizontalrule':
      return '---\n\n'

    case 'linebreak':
      return '\n'

    case 'list': {
      const listChildren = node.children ? serializeNodesToText(node.children, options) : ''
      return `${listChildren}\n`
    }

    case 'listitem': {
      const listItemChildren = node.children ? serializeNodesToText(node.children, options) : ''
      return `• ${listItemChildren}\n`
    }

    case 'paragraph': {
      const children = node.children ? serializeNodesToText(node.children, options) : ''
      return `${children}\n\n`
    }

    case 'quote': {
      const quoteChildren = node.children ? serializeNodesToText(node.children, options) : ''
      return `> ${quoteChildren}\n\n`
    }

    case 'text':
      return node.text || ''

    default:
      // Handle unknown nodes by processing children
      if (node.children) {
        return serializeNodesToText(node.children, options)
      }
      return ''
  }
}
