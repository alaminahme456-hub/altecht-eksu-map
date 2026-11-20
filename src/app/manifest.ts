import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ALTECH ALTECH EKSU Map Map',
    short_name: 'EKSU Map',
    description: 'ALTECH ALTECH ALTECH EKSU Map Map Map and walking navigation.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    categories: ['education', 'navigation', 'utilities'],
    icons: [
      { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  }
}
