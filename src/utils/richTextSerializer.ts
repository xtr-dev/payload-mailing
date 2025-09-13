// Proper type definitions for Lexical serialization
interface SerializedEditorState {
  root: {
    children: SerializedLexicalNode[]
  }
}

interface SerializedLexicalNode {
  type: string
  children?: SerializedLexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: 'number' | 'bullet'
  url?: string
  newTab?: boolean
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
  if (!node) return ''

  switch (node.type) {
    case 'paragraph':
      const children = node.children ? serializeNodesToHTML(node.children) : ''
      return `<p>${children}</p>`

    case 'heading':
      const headingChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const tag = node.tag || 'h1'
      return `<${tag}>${headingChildren}</${tag}>`

    case 'text':
      let text = node.text || ''

      // Apply text formatting using proper nesting order
      if (node.format) {
        const formatFlags = {
          bold: (node.format & 1) !== 0,
          italic: (node.format & 2) !== 0,
          strikethrough: (node.format & 4) !== 0,
          underline: (node.format & 8) !== 0,
          code: (node.format & 16) !== 0,
        }

        // Apply formatting in proper nesting order: code > bold > italic > underline > strikethrough
        if (formatFlags.code) text = `<code>${text}</code>`
        if (formatFlags.bold) text = `<strong>${text}</strong>`
        if (formatFlags.italic) text = `<em>${text}</em>`
        if (formatFlags.underline) text = `<u>${text}</u>`
        if (formatFlags.strikethrough) text = `<s>${text}</s>`
      }

      return text

    case 'linebreak':
      return '<br>'

    case 'list':
      const listChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${listTag}>${listChildren}</${listTag}>`

    case 'listitem':
      const listItemChildren = node.children ? serializeNodesToHTML(node.children) : ''
      return `<li>${listItemChildren}</li>`

    case 'quote':
      const quoteChildren = node.children ? serializeNodesToHTML(node.children) : ''
      return `<blockquote>${quoteChildren}</blockquote>`

    case 'link':
      const linkChildren = node.children ? serializeNodesToHTML(node.children) : ''
      const url = node.url || '#'
      const target = node.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${url}"${target}>${linkChildren}</a>`

    case 'horizontalrule':
      return '<hr>'

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
  if (!node) return ''

  switch (node.type) {
    case 'paragraph':
      const children = node.children ? serializeNodesToText(node.children) : ''
      return `${children}\n\n`

    case 'heading':
      const headingChildren = node.children ? serializeNodesToText(node.children) : ''
      return `${headingChildren}\n\n`

    case 'text':
      return node.text || ''

    case 'linebreak':
      return '\n'

    case 'list':
      const listChildren = node.children ? serializeNodesToText(node.children) : ''
      return `${listChildren}\n`

    case 'listitem':
      const listItemChildren = node.children ? serializeNodesToText(node.children) : ''
      return `• ${listItemChildren}\n`

    case 'quote':
      const quoteChildren = node.children ? serializeNodesToText(node.children) : ''
      return `> ${quoteChildren}\n\n`

    case 'link':
      const linkChildren = node.children ? serializeNodesToText(node.children) : ''
      const url = node.url || ''
      return `${linkChildren} (${url})`

    case 'horizontalrule':
      return '---\n\n'

    default:
      // Handle unknown nodes by processing children
      if (node.children) {
        return serializeNodesToText(node.children)
      }
      return ''
  }
}

/**
 * Applies Handlebars variables to richtext-generated HTML/text
 */
export function applyVariablesToContent(content: string, variables: Record<string, any>): string {
  // This function can be extended to handle more complex variable substitution
  // For now, it works with the Handlebars rendering that happens later
  return content
}