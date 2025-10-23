
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NIB EPMO',
    short_name: 'NIB EPMO',
    description: 'A project management solution to assign tasks and manage activity online.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f4c4',
    theme_color: '#4db6ac',
    icons: [
      {
        src: 'https://img.logoipsum.com/288.svg',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: 'https://img.logoipsum.com/288.svg',
        sizes: '512x512',
        type: 'image/svg+xml'
      }
    ],
  }
}

    