import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orders NG',
    short_name: 'Orders NG',
    description: 'Gestionale Officina22',
    start_url: '/',
    display: 'standalone',
    background_color: '#171717',
    theme_color: '#171717',
    icons: [
      { src: '/icons/orders-20261002-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/orders-20261002-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
