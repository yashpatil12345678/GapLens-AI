import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'GapLens AI — Find what’s missing', description: 'AI-assisted information gap detection for research verification.', generator: 'v0.app' }
export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#070b1a', userScalable: true }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html> }
