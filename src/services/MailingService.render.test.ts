import { describe, expect, test } from 'vitest'

import { MailingService } from './MailingService.js'
import { MustacheEngineAdapter, SimpleEngineAdapter, TemplateRenderError } from './templateEngines.js'

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

describe('renderTemplateDocument — template errors and strictTemplates', () => {
  // An unclosed block tag is a Liquid parse error.
  const BROKEN = 'Hi {{name}} {% if vip %}VIP'

  test('default (non-strict) falls back to simple substitution, as before', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template(BROKEN, 'hi'), { name: 'Ann' })
    expect(html).toContain('Hi Ann')
    expect(html).toContain('{% if vip %}')
  })

  test('strictTemplates throws a TemplateRenderError on a Liquid parse error', async () => {
    const svc = makeService({ strictTemplates: true })
    const render = svc.renderTemplateDocument(template(BROKEN, 'hi'), { name: 'Ann' })
    await expect(render).rejects.toBeInstanceOf(TemplateRenderError)
    await expect(render).rejects.toThrow(/LiquidJS template rendering failed/)
  })

  test('strictTemplates also throws for a broken subject', async () => {
    const svc = makeService({ strictTemplates: true })
    await expect(
      svc.renderTemplateDocument(template('body', '{% if x %}open'), {}),
    ).rejects.toBeInstanceOf(TemplateRenderError)
  })

  test('strictTemplates leaves valid templates unaffected', async () => {
    const svc = makeService({ strictTemplates: true })
    const { html, subject } = await svc.renderTemplateDocument(
      template('{% if vip %}VIP {% endif %}{{ name }}', 'Hi {{ name }}'),
      { name: 'Ann', vip: true },
    )
    expect(html).toBe('<p>VIP Ann</p>')
    expect(subject).toBe('Hi Ann')
  })

  test('strictTemplates throws when a custom templateRenderer throws', async () => {
    const svc = makeService({
      strictTemplates: true,
      templateRenderer: () => {
        throw new Error('boom')
      },
    })
    await expect(svc.renderTemplateDocument(template('x', 'y'), {})).rejects.toThrow(
      /Custom template rendering failed: boom/,
    )
  })

  test('strictTemplates makes an unknown Liquid filter an error', async () => {
    const svc = makeService({ strictTemplates: true })
    await expect(
      svc.renderTemplateDocument(template('{{ name | noSuchFilter }}', 's'), { name: 'Ann' }),
    ).rejects.toBeInstanceOf(TemplateRenderError)
  })

  test('without strictTemplates an unknown Liquid filter is still ignored', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template('{{ name | noSuchFilter }}', 's'), { name: 'Ann' })
    expect(html).toBe('<p>Ann</p>')
  })
})

describe('renderTemplateDocument — quoted Liquid arguments in a rich-text HTML body', () => {
  test('single- and double-quoted arguments render in the HTML body (no fallback)', async () => {
    const svc = makeService()
    const { html, text } = await svc.renderTemplateDocument(
      template(
        `{% if s == 'paid' %}PAID{% endif %} {{ n | default: 'x' }} {{ d | date: "%Y" }}`,
        's',
      ),
      { d: '2026-03-05T12:00:00.000Z', s: 'paid' },
    )
    expect(html).toBe('<p>PAID x 2026</p>')
    expect(text).toContain('PAID x 2026')
  })

  test('substituted values are still HTML-escaped, including quotes', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template(`{{ v | default: 'x' }}`, 's'),
      { v: `<b>"it's"</b>` },
    )
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain(`"it's"`)
  })
})


describe('renderTemplateDocument — Liquid comparisons in a rich-text HTML body', () => {
  test.each([
    ['{% if n > 5 %}big{% endif %}', 'big'],
    ['{% if n < 5 %}small{% else %}not small{% endif %}', 'not small'],
    ['{% if n >= 7 %}ge{% endif %}', 'ge'],
    ['{% if n <= 7 %}le{% endif %}', 'le'],
    ['{% if n == 7 %}eq{% endif %}', 'eq'],
    ['{%- if n > 5 -%}trim{%- endif -%}', 'trim'],
    ['{{- n | plus: 1 -}}', '8'],
  ])('%s renders in the HTML body', async (source, expected) => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template(source, 's'), { n: 7 })
    expect(html).toBe(`<p>${expected}</p>`)
  })

  test('literal <b> typed outside a tag is still escaped', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template('Use <b>bold</b> {% if n > 5 %}now{% endif %} & go', 's'),
      { n: 7 },
    )
    expect(html).toBe('<p>Use &lt;b&gt;bold&lt;/b&gt; now &amp; go</p>')
  })

  test('an injection attempt in text around tags stays escaped', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template('<img src=x onerror=alert(1)>{% if n > 5 %}ok{% endif %}<script>x</script>', 's'),
      { n: 7 },
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;ok&lt;script&gt;')
  })

  test('output values are still escaped', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(
      template('{% if n > 5 %}{{ v }}{% endif %}', 's'),
      { n: 7, v: '<img src=x onerror=alert(1)>' },
    )
    expect(html).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>')
  })

  test('{% echo %} with a literal is output unescaped (author-controlled, documented)', async () => {
    // liquidjs does not apply outputEscape to `echo`; this pins that behaviour
    // so a change in liquidjs or in the passthrough is noticed.
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template('{% echo "<b>x</b>" %}', 's'), {})
    expect(html).toBe('<p><b>x</b></p>')
  })
})

describe('renderTemplateDocument — markup inside tags that do not parse is escaped', () => {
  const BROKEN = [
    '{{ <img src=x onerror=alert(1)> }}',
    '{% <script>alert(1)</script> %}',
    // An unclosed opener: the non-greedy match runs to the next closer.
    '{% if n > 5 <img src=x onerror=alert(1)> {{ n }}',
  ]

  test.each(BROKEN)('liquidjs: %s', async (source) => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template(source, 's'), { n: 7 })
    expect(html).not.toMatch(/<img|<script/)
  })

  test.each(BROKEN)('simple engine: %s', async (source) => {
    const svc = makeService({ templateEngine: 'simple' })
    const { html } = await svc.renderTemplateDocument(template(source, 's'), { n: 7 })
    expect(html).not.toMatch(/<img|<script/)
    expect(html).toContain('&lt;')
  })

  test.each([
    ...BROKEN,
    // Unclosed Mustache section: Mustache throws, the adapter falls back.
    '{{#items}}<img src=x onerror=alert(1)>',
  ])('mustache: %s', async (source) => {
    const svc = makeService({ templateEngine: 'mustache' })
    const { html } = await svc.renderTemplateDocument(template(source, 's'), { n: 7 })
    expect(html).not.toMatch(/<img|<script/)
  })

  test('mustache still evaluates {{ }} and escapes {% %} as text', async () => {
    const svc = makeService({ templateEngine: 'mustache' })
    const { html } = await svc.renderTemplateDocument(template('{% x > 1 %} {{ n }}', 's'), { n: 7 })
    expect(html).toBe('<p>{% x &gt; 1 %} 7</p>')
  })
})

describe('renderTemplateDocument — strictTemplates with the engine-aware HTML body', () => {
  const MARKUP_IN_BROKEN_TAG = '{{ <img onerror=x> }}'

  test.each(['liquidjs', 'mustache'] as const)(
    '%s: strict mode throws on an unparseable tag containing markup (no fallback)',
    async (templateEngine) => {
      const source = templateEngine === 'mustache' ? '{{#items}}<img onerror=x>' : MARKUP_IN_BROKEN_TAG
      const svc = makeService({ strictTemplates: true, templateEngine })
      await expect(svc.renderTemplateDocument(template(source, 's'), {})).rejects.toBeInstanceOf(
        TemplateRenderError,
      )
    },
  )

  test('non-strict: the same input falls back to the fully escaped body', async () => {
    const svc = makeService()
    const { html } = await svc.renderTemplateDocument(template(MARKUP_IN_BROKEN_TAG, 's'), {})
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img onerror=x&gt;')
  })

  test.each([
    [`{% if s == 'paid' %}PAID{% endif %}`, 'PAID'],
    [`{{ m | default: "x" }}`, 'x'],
    ['{% if n > 5 %}big{% endif %}', 'big'],
    ['{% if n < 5 %}small{% else %}not small{% endif %}', 'not small'],
  ])('strict mode renders %s in the HTML body', async (source, expected) => {
    const svc = makeService({ strictTemplates: true })
    const { html } = await svc.renderTemplateDocument(template(source, 's'), { n: 7, s: 'paid' })
    expect(html).toBe(`<p>${expected}</p>`)
  })
})

describe('MustacheEngineAdapter.renderHtml — strict mode', () => {
  const throwingMustache = {
    render: () => {
      throw new Error('unclosed section')
    },
  }

  test('strict: throws instead of rendering the escaped fallback', async () => {
    const adapter = new MustacheEngineAdapter(throwingMustache, new SimpleEngineAdapter(), () => {}, true)
    await expect(adapter.renderHtml('{{#a}}<img>', {}, '{{#a}}&lt;img&gt;')).rejects.toBeInstanceOf(
      TemplateRenderError,
    )
  })

  test('non-strict: renders the escaped fallback', async () => {
    const adapter = new MustacheEngineAdapter(throwingMustache, new SimpleEngineAdapter(), () => {})
    await expect(adapter.renderHtml('{{#a}}<img>', {}, '{{#a}}&lt;img&gt;')).resolves.toBe('{{#a}}&lt;img&gt;')
  })
})
