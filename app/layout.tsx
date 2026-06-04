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
  title: 'señorita 🌻',
  description: 'una proposta...',
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
