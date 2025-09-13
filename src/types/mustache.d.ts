declare module 'mustache' {
  interface MustacheStatic {
    render(template: string, view?: any, partials?: any, tags?: string[]): string
  }
  const mustache: MustacheStatic
  export = mustache
}