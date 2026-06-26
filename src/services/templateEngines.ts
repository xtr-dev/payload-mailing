import type { Liquid } from 'liquidjs'

import { escapeHtml } from '../utils/richTextSerializer.js'

/**
 * Abstraction over the supported template engines.
 *
 * Engines disagree on *how* HTML escaping is controlled, and that difference is
 * exactly what makes layout composition tricky:
 *
 * - LiquidJS and the simple replacer choose escaping by *render mode* — a flag
 *   selected per render — so a layout can be rendered with escaping turned off
 *   while the caller pre-escapes the variables it wants escaped.
 * - Mustache chooses escaping by *syntax* (`{{ }}` always escapes, `{{{ }}}` is
 *   raw) with no per-render toggle, so the same trick double-escapes.
 *
 * Each adapter encapsulates its engine's escaping model so the caller can treat
 * "render verbatim", "render as HTML", and "wrap a body in a layout" uniformly.
 */
export interface TemplateEngineAdapter {
  /**
   * Wraps an already-rendered body in a layout. `content` is the rendered body
   * and is injected raw — it was escaped (when appropriate) during its own
   * render pass and must not be escaped again. The layout's own variables are
   * HTML-escaped when `escapeVariables` is true (HTML layouts) and emitted
   * verbatim when false (plain-text layouts).
   */
  composeLayout(
    layout: string,
    content: string,
    variables: Record<string, any>,
    escapeVariables: boolean,
  ): Promise<string>
  /** Renders a template, emitting substituted values verbatim (no escaping). */
  render(template: string, variables: Record<string, any>): Promise<string>
  /** Renders a template into HTML, HTML-escaping substituted values. */
  renderHtml(template: string, variables: Record<string, any>): Promise<string>
}

export type RenderErrorLogger = (message: string, error: unknown) => void

/** The slice of the `mustache` package this module depends on. */
export type MustacheModule = {
  render(
    template: string,
    variables: Record<string, any>,
    partials?: Record<string, string>,
    config?: { escape?: (value: string) => string },
  ): string
}

// Matches a `content` output tag in any supported engine syntax: Mustache raw
// `{{{ content }}}`, the double-brace `{{ content }}`, and the Liquid/Mustache
// whitespace-trim markers `{{- content -}}`. The triple-brace alternative is
// listed first so it matches before the double-brace alternative would.
const CONTENT_SLOT = /\{\{\{-?\s*content\s*-?\}\}\}|\{\{-?\s*content\s*-?\}\}/g

/** Recursively HTML-escapes every string in a variables structure. */
function deepEscape(value: any): any {
  if (typeof value === 'string') {
    return escapeHtml(value)
  }
  if (Array.isArray(value)) {
    return value.map(deepEscape)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = deepEscape(val)
    }
    return out
  }
  return value
}

/**
 * Base strategy for engines whose escaping is mode-based (LiquidJS, the simple
 * replacer). The layout renders with escaping turned OFF and the non-`content`
 * variables pre-escaped in JS, so `content` flows through verbatim while every
 * other variable is escaped exactly once.
 */
abstract class ModeBasedAdapter implements TemplateEngineAdapter {
  async composeLayout(
    layout: string,
    content: string,
    variables: Record<string, any>,
    escapeVariables: boolean,
  ): Promise<string> {
    const vars = escapeVariables ? deepEscape(variables) : variables
    // `content` is added last so it always wins over a same-named variable and
    // is never run through deepEscape — it must reach the engine raw.
    return this.render(layout, { ...vars, content })
  }

  abstract render(template: string, variables: Record<string, any>): Promise<string>
  abstract renderHtml(template: string, variables: Record<string, any>): Promise<string>
}

/**
 * Last-resort engine: substitutes `{{ name }}` tokens with no template-language
 * features. It has no escaping syntax, so escaping is applied directly to the
 * substituted value when rendering HTML.
 */
export class SimpleEngineAdapter extends ModeBasedAdapter {
  private replace(template: string, variables: Record<string, any>, escape: boolean): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key]
      if (value === undefined) {
        return match
      }
      const str = String(value)
      return escape ? escapeHtml(str) : str
    })
  }

  render(template: string, variables: Record<string, any>): Promise<string> {
    return Promise.resolve(this.replace(template, variables, false))
  }

  renderHtml(template: string, variables: Record<string, any>): Promise<string> {
    return Promise.resolve(this.replace(template, variables, true))
  }
}

/**
 * LiquidJS adapter. Two pre-built engine instances back it: `liquid` emits
 * output verbatim (subjects, plain text, and — with pre-escaped variables —
 * layouts), while `liquidEscaped` HTML-escapes every `{{ output }}` for the
 * HTML body. A render-time failure falls back to the simple replacer, matching
 * the behaviour from before engines were adapter-based.
 */
export class LiquidEngineAdapter extends ModeBasedAdapter {
  constructor(
    private liquid: Liquid,
    private liquidEscaped: Liquid,
    private fallback: TemplateEngineAdapter,
    private onError: RenderErrorLogger,
  ) {
    super()
  }

  async render(template: string, variables: Record<string, any>): Promise<string> {
    try {
      return await this.liquid.parseAndRender(template, variables)
    } catch (error) {
      this.onError('LiquidJS template rendering error:', error)
      return this.fallback.render(template, variables)
    }
  }

  async renderHtml(template: string, variables: Record<string, any>): Promise<string> {
    try {
      return await this.liquidEscaped.parseAndRender(template, variables)
    } catch (error) {
      this.onError('LiquidJS template rendering error:', error)
      return this.fallback.renderHtml(template, variables)
    }
  }
}

// The control character that marks the content slot in the Mustache strategy.
// SOH (U+0001) cannot appear in legitimate template source, HTML, or email
// text, which lets us strip it from every input to guarantee the only
// occurrences in the rendered layout are the ones we inserted.
const SENTINEL_CHAR = '\x01'
const CONTENT_SENTINEL = `${SENTINEL_CHAR}LAYOUT_CONTENT${SENTINEL_CHAR}`

// Identity escape function used to turn Mustache's built-in `{{ }}` HTML escaping
// OFF for a single render. Layout variables are pre-escaped in JS instead, so the
// escaping behaviour matches the mode-based engines exactly and `{{{ }}}` is not a
// raw opt-out for layout variables.
const NO_ESCAPE = (value: string): string => value

/** Removes every sentinel marker character from a variables structure. */
function stripSentinel(value: any): any {
  if (typeof value === 'string') {
    return value.split(SENTINEL_CHAR).join('')
  }
  if (Array.isArray(value)) {
    return value.map(stripSentinel)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = stripSentinel(val)
    }
    return out
  }
  return value
}

/**
 * Mustache adapter. Mustache always HTML-escapes `{{ }}` output, so the body
 * render uses that native escaping. Layout composition cannot, however: the
 * content slot must be injected raw while the layout's own variables must be
 * escaped exactly once, with no `{{{ }}}` raw opt-out (matching the mode-based
 * engines). So `composeLayout` replaces the content slot with a control-char
 * sentinel BEFORE Mustache runs, pre-escapes the remaining variables in JS,
 * renders with Mustache's native escaping turned OFF, and splices the
 * already-rendered body into the sentinel position afterward.
 */
export class MustacheEngineAdapter implements TemplateEngineAdapter {
  constructor(
    private mustache: MustacheModule,
    private fallback: TemplateEngineAdapter,
    private onError: RenderErrorLogger,
  ) {}

  async composeLayout(
    layout: string,
    content: string,
    variables: Record<string, any>,
    escapeVariables: boolean,
  ): Promise<string> {
    try {
      // Strip the sentinel marker from the layout source first, then insert our
      // own slot marker — so the only sentinel in the post-render output is the
      // one we put there, never a stray copy from the developer-authored layout.
      const layoutWithSlot = layout.split(SENTINEL_CHAR).join('').replace(CONTENT_SLOT, CONTENT_SENTINEL)

      // Pre-escape the layout's own variables in JS (HTML layouts only; plain
      // text emits them verbatim) and strip the sentinel marker from every
      // value. Stripping is essential: HTML escaping leaves control characters
      // untouched, so a value containing the marker would otherwise survive and
      // forge a second content slot — splicing the body into an attacker-chosen
      // spot.
      const safeVariables = stripSentinel(escapeVariables ? deepEscape(variables) : variables)

      // Render with Mustache's `{{ }}` escaping disabled so the pre-escaped
      // values pass through exactly once, regardless of whether the layout uses
      // `{{ x }}` or `{{{ x }}}`. This mirrors the mode-based strategy and means
      // layout variables have no raw opt-out, which is correct for values that
      // may be user-controlled.
      const rendered = this.mustache.render(layoutWithSlot, safeVariables, undefined, { escape: NO_ESCAPE })
      // String#split/join (not String#replace) so a `$`-sequence in the body is
      // inserted literally rather than interpreted as a replacement pattern.
      return rendered.split(CONTENT_SENTINEL).join(content)
    } catch (error) {
      this.onError('Mustache template rendering error:', error)
      return this.fallback.composeLayout(layout, content, variables, escapeVariables)
    }
  }

  async render(template: string, variables: Record<string, any>): Promise<string> {
    try {
      return this.mustache.render(template, variables)
    } catch (error) {
      this.onError('Mustache template rendering error:', error)
      return this.fallback.render(template, variables)
    }
  }

  async renderHtml(template: string, variables: Record<string, any>): Promise<string> {
    // Mustache always escapes `{{ }}` output, so HTML and verbatim rendering are
    // identical; the distinction only matters for the mode-based engines.
    return this.render(template, variables)
  }
}

/**
 * Adapter for a user-supplied `templateRenderer` hook. Custom renderers are
 * responsible for their own output escaping, so no escaping is applied here and
 * the layout body is exposed through a `content` variable exactly as before.
 */
export class CustomRendererAdapter implements TemplateEngineAdapter {
  constructor(
    private renderer: (template: string, variables: Record<string, any>) => Promise<string> | string,
    private onError: RenderErrorLogger,
  ) {}

  async composeLayout(
    layout: string,
    content: string,
    variables: Record<string, any>,
    _escapeVariables: boolean,
  ): Promise<string> {
    return this.render(layout, { ...variables, content })
  }

  async render(template: string, variables: Record<string, any>): Promise<string> {
    try {
      return await this.renderer(template, variables)
    } catch (error) {
      this.onError('Custom template renderer error:', error)
      return template
    }
  }

  async renderHtml(template: string, variables: Record<string, any>): Promise<string> {
    return this.render(template, variables)
  }
}
