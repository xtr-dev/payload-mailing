// Using any type for now since Lexical types have import issues
// import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
type SerializedEditorState = any

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

function serializeNodesToHTML(nodes: any[]): string {
  return nodes.map(node => serializeNodeToHTML(node)).join('')
}

function serializeNodeToHTML(node: any): string {
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
      
      // Apply text formatting
      if (node.format) {
        if (node.format & 1) text = `<strong>${text}</strong>` // Bold
        if (node.format & 2) text = `<em>${text}</em>` // Italic
        if (node.format & 4) text = `<s>${text}</s>` // Strikethrough  
        if (node.format & 8) text = `<u>${text}</u>` // Underline
        if (node.format & 16) text = `<code>${text}</code>` // Code
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

function serializeNodesToText(nodes: any[]): string {
  return nodes.map(node => serializeNodeToText(node)).join('')
}

function serializeNodeToText(node: any): string {
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