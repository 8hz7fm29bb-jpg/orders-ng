import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orders NG',
    short_name: 'Orders NG',
    description: 'Gestionale Officina22',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f2ef',
    theme_color: '#171717',
  }
}
