import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'streamlifyBackup',
  description: 'Back up and migrate your Spotify playlists and liked songs',
}

// Mobile: proper scaling, notch safe area and a dark browser bar
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#070a08',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
