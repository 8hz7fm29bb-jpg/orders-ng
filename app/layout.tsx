import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Orders NG',
  description: 'Gestione eventi, ricette e food cost Officina22',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Orders NG', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#171717',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>
}
