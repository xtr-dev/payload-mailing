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

  return { newTab, url: typeof url === 'string' ? url.trim() : '' }
}

/**
 * Escapes HTML-significant characters to prevent HTML injection in serialized output.
 * Exported so the rendering pipeline can reuse the exact same escaping when it
 * substitutes template variables into the HTML body (see MailingService).
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
      return `<a href="${safeUrl(url)}"${target}>${linkChildren}</a>`
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
      let text = escapeHtml(node.text || '')

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
