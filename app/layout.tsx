import type { Metadata, Viewport } from 'next'
import { Montserrat, Open_Sans } from 'next/font/google'

import { LABELS } from '@/lib/consts'

import './globals.css'

/** Body: без link preload — меньше конкуренции с LCP (заголовки на Montserrat). */
const openSans = Open_Sans({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-open-sans',
  display: 'swap',
  preload: false,
})

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-montserrat',
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: LABELS.META_TITLE_DEFAULT,
    template: LABELS.META_TITLE_TEMPLATE,
  },
  description: LABELS.META_DESCRIPTION,
  keywords: [
    LABELS.META_KEYWORD_1,
    LABELS.META_KEYWORD_2,
    LABELS.META_KEYWORD_3,
    LABELS.META_KEYWORD_4,
    LABELS.META_KEYWORD_5,
  ],
  authors: [{ name: LABELS.META_AUTHOR_NAME }],
  creator: LABELS.META_AUTHOR_NAME,
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: LABELS.META_KEYWORD_1,
    title: LABELS.META_OG_TITLE,
    description: LABELS.META_OG_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: LABELS.META_TWITTER_TITLE,
    description: LABELS.META_TWITTER_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFE2BA' },
    { media: '(prefers-color-scheme: dark)', color: '#4056A1' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${openSans.variable} ${montserrat.variable} bg-background`}>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  )
}
