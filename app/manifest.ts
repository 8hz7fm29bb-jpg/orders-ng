import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orders NG',
    short_name: 'Orders NG',
    description: 'Gestionale eventi e food cost Officina22',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f4f1',
    theme_color: '#171717',
    icons: [],
  }
}
