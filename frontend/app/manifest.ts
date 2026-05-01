import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CondoFlow Resident Portal',
    short_name: 'CondoFlow',
    description: 'Mobile-first resident portal for debt, invoices, payments and issues',
    start_url: '/resident',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icons/pwa-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/pwa-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}

