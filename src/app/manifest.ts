
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
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/NIB_International_Bank_logo.png/192px-NIB_International_Bank_logo.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/NIB_International_Bank_logo.png/512px-NIB_International_Bank_logo.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
  }
}
