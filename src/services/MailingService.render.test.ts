import { describe, expect, test } from 'vitest'

import { MailingService } from './MailingService.js'

// A stub Payload that satisfies the service's initialization checks. The render
// tests call `renderTemplateDocument` with a pre-built template document, so no
// database access or email adapter behaviour is exercised.
const stubPayload = () => ({ db: {}, email: {} }) as any

const makeService = (config: Record<string, any> = {}) =>
  new MailingService(stubPayload(), config as any)

// Builds a template document with a single-paragraph rich-text body.
const template = (bodyText: string, subject: string) =>
  ({
    content: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: bodyText }] }] } },
    subject,
  }) as any

const XSS = '<img src=x onerror=alert(1)>'

describe('renderTemplateDocument — variable escaping (LiquidJS, default engine)', () => {
  test('HTML body escapes a variable containing markup', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template('Hello, {{ name }}!', 'hi'),
      { name: XSS },
    )
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img src=x')
  })

  test('subject does NOT HTML-escape (keeps & and markup verbatim)', async () => {
    const svc = makeService()
    const { subject } = await svc.renderTemplateDocument(
      template('body', '{{ name }} & Co'),
      { name: XSS },
    )
    expect(subject).toBe('<img src=x onerror=alert(1)> & Co')
    expect(subject).not.toContain('&amp;')
    expect(subject).not.toContain('&lt;')
  })

  test('plain-text body does NOT HTML-escape', async () => {
    const svc = makeService()
    const { text } = await svc.renderTemplateDocument(
      template('Hello, {{ name }}!', 'hi'),
      { name: 'Tom & Jerry' },
    )
    expect(text).toContain('Tom & Jerry')
    expect(text).not.toContain('&amp;')
  })

  test('the `| raw` filter opts a variable back into unescaped HTML output', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template('Hi {{ name | raw }}', 'hi'),
      { name: XSS },
    )
    expect(html).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('renderTemplateDocument — variable escaping (simple engine)', () => {
  // The simple engine matches `{{name}}` without surrounding spaces.
  test('HTML body escapes substituted values; subject does not', async () => {
    const svc = makeService({ templateEngine: 'simple' })
    const { html, subject } = await svc.renderTemplateDocument(
      template('Hello, {{name}}!', '{{name}}'),
      { name: '<b>bad</b>' },
    )
    expect(html).toContain('Hello, &lt;b&gt;bad&lt;/b&gt;!')
    expect(html).not.toContain('<b>bad</b>')
    expect(subject).toBe('<b>bad</b>')
  })
})

// This is the exact render path the in-admin preview endpoint invokes
// (renderTemplateDocument with draft content + selected layout + sample
// variables), so these also cover the layout composition added in Part 1.
describe('renderTemplateDocument — layout composition', () => {
  const layoutsConfig = {
    layouts: {
      branded: {
        html: '<header>ACME</header><main>{{ content }}</main>',
        text: '== ACME ==\n{{ content }}',
      },
    },
  }

  test('wraps the HTML and text body in the configured defaultLayout', async () => {
    const svc = makeService({ ...layoutsConfig, defaultLayout: 'branded' })
    const { html, text } = await svc.renderTemplateDocument(
      template('Hello, {{ name }}!', 'hi'),
      { name: 'Ada' },
    )
    expect(html).toContain('<header>ACME</header>')
    expect(html).toContain('<main>')
    expect(html).toContain('Hello, Ada!')
    expect(text).toContain('== ACME ==')
    expect(text).toContain('Hello, Ada!')
  })

  test('the template body is injected verbatim (escaped once, not double-escaped)', async () => {
    const svc = makeService({ ...layoutsConfig, defaultLayout: 'branded' })
    const { html } = await svc.renderTemplateDocument(
      template('Hi {{ name }}', 'hi'),
      { name: XSS },
    )
    // Escaped exactly once by the body render; the layout wrap must not re-escape.
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('&amp;lt;')
  })

  test('a template layout of "none" opts out of the defaultLayout', async () => {
    const svc = makeService({ ...layoutsConfig, defaultLayout: 'branded' })
    const tpl = { ...template('Body', 'hi'), layout: 'none' }
    const { html } = await svc.renderTemplateDocument(tpl, {})
    expect(html).not.toContain('ACME')
    expect(html).toContain('Body')
  })

  test('no layouts configured renders the body unwrapped (back-compat)', async () => {
    const svc = makeService()
    const { html, text } = await svc.renderTemplateDocument(template('Plain', 'hi'), {})
    expect(html).toContain('Plain')
    expect(html).not.toContain('ACME')
    expect(text).toContain('Plain')
  })

  test('non-content layout variables are HTML-escaped (no XSS via layout vars)', async () => {
    const svc = makeService({
      defaultLayout: 'branded',
      layouts: { branded: { html: '<header>{{ siteName }}</header><main>{{ content }}</main>' } },
    })
    const { html } = await svc.renderTemplateDocument(
      template('Body', 'hi'),
      { siteName: '<script>evil()</script>' },
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

// Mustache always HTML-escapes `{{ }}` output and has no per-render escape
// toggle, so layout composition uses a sentinel-splice strategy instead of the
// pre-escape strategy the mode-based engines use.
describe('renderTemplateDocument — Mustache layout composition', () => {
  const mustacheConfig = (layoutHtml: string) => ({
    defaultLayout: 'branded',
    layouts: { branded: { html: layoutHtml } },
    templateEngine: 'mustache',
  })

  test('content slot is injected raw with triple-brace {{{ content }}} (no double-escape)', async () => {
    const svc = makeService(mustacheConfig('<main>{{{ content }}}</main>'))
    const { html } = await svc.renderTemplateDocument(template('Hi {{ name }}', 'hi'), { name: XSS })
    expect(html).toContain('<main>')
    // The body was escaped once by its own render pass; the layout wrap must not
    // re-escape it (which would produce `&amp;lt;`).
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('&amp;lt;')
  })

  test('content slot also works with double-brace {{ content }}', async () => {
    const svc = makeService(mustacheConfig('<main>{{ content }}</main>'))
    const { html } = await svc.renderTemplateDocument(template('Hi {{ name }}', 'hi'), { name: XSS })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('&amp;lt;')
  })

  test('non-content layout variables are escaped by Mustache', async () => {
    const svc = makeService(mustacheConfig('<header>{{ siteName }}</header><main>{{{ content }}}</main>'))
    const { html } = await svc.renderTemplateDocument(
      template('Body', 'hi'),
      { siteName: '<script>x</script>' },
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  test('triple-brace {{{ siteName }}} is NOT a raw opt-out for layout variables', async () => {
    // Layout variables are escaped before Mustache runs and rendered with native
    // escaping disabled, so {{{ }}} cannot resurrect raw HTML — matching the
    // mode-based engines, where layout variables have no opt-out either.
    const svc = makeService(mustacheConfig('<header>{{{ siteName }}}</header><main>{{{ content }}}</main>'))
    const { html } = await svc.renderTemplateDocument(
      template('Body', 'hi'),
      { siteName: '<script>x</script>' },
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  test('a variable cannot forge the internal content sentinel (injection guard)', async () => {
    const svc = makeService(mustacheConfig('<header>{{ siteName }}</header><main>{{{ content }}}</main>'))
    // A value crafted to look like the internal slot marker must be neutralised,
    // never treated as a second content slot that the body gets spliced into.
    const { html } = await svc.renderTemplateDocument(
      template('REAL_BODY', 'hi'),
      { siteName: '\x01LAYOUT_CONTENT\x01' },
    )
    // The body appears exactly once, at the genuine content slot.
    expect(html.split('REAL_BODY').length - 1).toBe(1)
    // The sentinel marker character never leaks into the rendered output.
    expect(html).not.toContain('\x01')
  })
})
