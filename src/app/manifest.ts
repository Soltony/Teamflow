
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
        src: '/img/logo.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/img/logo.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
  }
}
