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
      { src: '/orders-icon?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
