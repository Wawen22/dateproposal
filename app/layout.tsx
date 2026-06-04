import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: 'Visita col dottore',
  description: 'una proposta, señorita 🌻',
  openGraph: {
    title: 'Visita col dottore',
    description: 'una proposta, señorita 🌻',
    locale: 'it_IT',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Visita col dottore',
    description: 'una proposta, señorita 🌻',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body
        className={`${nunito.variable} antialiased`}
        style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
