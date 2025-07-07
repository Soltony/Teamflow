
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NIB PMO',
    short_name: 'NIB PMO',
    description: 'A project management solution to assign tasks and manage activity online.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f4c4',
    theme_color: '#4db6ac',
    icons: [
      {
        src: 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
  }
}
