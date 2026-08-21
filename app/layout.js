import './globals.css'
export const metadata = {
  title: 'SochGuru Creator CMS - Content Management Tool',
  description: 'Voice, Video, Gesture, Persona, Avatar, Bilingual Content Management for Creators',
  manifest: '/manifest.json',
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
  return (<html lang="en"><body>{children}</body></html>)
}
