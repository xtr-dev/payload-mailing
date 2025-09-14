import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PayloadCMS Mailing Plugin - Development',
  description: 'Development environment for PayloadCMS Mailing Plugin',
}

export default function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {children}
      </body>
    </html>
  )
}