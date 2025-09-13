# Template Engine Options

The plugin now supports flexible template rendering with multiple options:

1. **String-based Configuration** (easy setup with built-in engines)
2. **Custom Template Renderer Hook** (maximum flexibility)
3. **Simple Variable Replacement** (fallback, no dependencies)

## Configuration Options

### String-based Template Engine Configuration
Easy setup using built-in template engines:

```typescript
// Using LiquidJS (default, requires: npm install liquidjs)
mailingPlugin({
  templateEngine: 'liquidjs'
})

// Using Mustache (requires: npm install mustache)
mailingPlugin({
  templateEngine: 'mustache'
})

// Using simple variable replacement (no dependencies)
mailingPlugin({
  templateEngine: 'simple'
})
```

### Custom Template Renderer Hook
```typescript
// Example with Handlebars
import Handlebars from 'handlebars'

mailingPlugin({
  templateRenderer: async (template: string, variables: Record<string, any>) => {
    const compiled = Handlebars.compile(template)
    return compiled(variables)
  }
})

// Example with Mustache
import Mustache from 'mustache'

mailingPlugin({
  templateRenderer: async (template: string, variables: Record<string, any>) => {
    return Mustache.render(template, variables)
  }
})

// Example with Nunjucks
import nunjucks from 'nunjucks'

mailingPlugin({
  templateRenderer: async (template: string, variables: Record<string, any>) => {
    return nunjucks.renderString(template, variables)
  }
})
```

### Using LiquidJS (Optional)
Install the optional dependency:
```bash
npm install liquidjs
# or
pnpm add liquidjs
```

### Fallback Mode
If no custom renderer is provided and neither LiquidJS nor Mustache are installed, simple `{{variable}}` replacement is used.

## Template Syntax Reference

### Mustache Syntax (Logic-less)
```mustache
Hello {{user.name}},

{{#user.isPremium}}
  Welcome to premium! Your balance is {{balance}}.
{{/user.isPremium}}

{{#orders}}
  Order: {{id}} - {{date}}
{{/orders}}
```

### LiquidJS Syntax (With Logic)
```liquid
Hello {{user.name}},

{% if user.isPremium %}
  Welcome to premium! Your balance is {{balance | formatCurrency}}.
{% endif %}

{% for order in orders %}
  Order: {{order.id}} - {{order.date | formatDate: "short"}}
{% endfor %}
```

### Simple Variable Replacement
```
Hello {{user.name}},
Your balance is {{balance}}.
```

## Migration from Handlebars

### Variables
- **Handlebars**: `{{variable}}`
- **LiquidJS**: `{{variable}}` (same)

### Conditionals
- **Handlebars**: `{{#if condition}}content{{/if}}`
- **LiquidJS**: `{% if condition %}content{% endif %}`

### Loops
- **Handlebars**: `{{#each items}}{{this}}{{/each}}`
- **LiquidJS**: `{% for item in items %}{{item}}{% endfor %}`

### Filters/Helpers
- **Handlebars**: `{{formatDate date "short"}}`
- **LiquidJS**: `{{date | formatDate: "short"}}`

### Available Filters
- `formatDate` - Format dates (short, long, or default)
- `formatCurrency` - Format currency amounts
- `capitalize` - Capitalize first letter

### Comparison Operations (LiquidJS Advantage)
- **Handlebars**: Required `{{#ifEquals}}` helper
- **LiquidJS**: Built-in: `{% if user.role == "admin" %}`

## Example Migration

### Before (Handlebars)
```handlebars
Hello {{user.name}},

{{#if user.isPremium}}
  Welcome to premium! Your balance is {{formatCurrency balance}}.
{{/if}}

{{#each orders}}
  Order: {{this.id}} - {{formatDate this.date "short"}}
{{/each}}
```

### After (LiquidJS)
```liquid
Hello {{user.name}},

{% if user.isPremium %}
  Welcome to premium! Your balance is {{balance | formatCurrency}}.
{% endif %}

{% for order in orders %}
  Order: {{order.id}} - {{order.date | formatDate: "short"}}
{% endfor %}
```