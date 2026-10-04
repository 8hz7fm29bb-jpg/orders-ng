import './globals.css'
import './recipe-categories.css'
import './brand.css'
import './ingredient-unit.css'
import './event-form.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Orders NextGen',
  description: 'Gestione eventi, ricette e food cost Officina22',
  manifest: '/manifest.webmanifest?v=20261002b',
  icons: {
    icon: [{ url: '/safari-icon?v=20261004', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/icons/orders-20261002b-180.png', type: 'image/png', sizes: '180x180' }],
  },
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
