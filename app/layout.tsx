import './globals.css'
import './recipe-categories.css'
import './brand.css'
import './ingredient-unit.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Orders NextGen',
  description: 'Gestione eventi, ricette e food cost Officina22',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '22 Orders', statusBarStyle: 'default' },
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
