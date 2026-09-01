import './globals.css'

export const metadata = {
  title: 'SochGuru Creator CMS',
  description: 'Write once, publish bilingual — Nepali and English content for creators, from one prompt.',
  manifest: '/manifest.json',
  // Private creator tool: keep it out of search results even if robots.txt is missed.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png'
  }
}

export const viewport = {
  themeColor: '#FF6B00',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
