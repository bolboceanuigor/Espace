import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { BrandingProvider } from '@/context/BrandingContext'
import { ToastProvider } from '@/components/ui'
import ThemeColorMeta from '@/components/layout/ThemeColorMeta'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import ClientErrorBoundary from '@/components/monitoring/ClientErrorBoundary'
import { defaultLocale } from '@/i18n'
import roMessages from '@/messages/ro.json'

const onest = localFont({
  src: '../public/fonts/onest/Onest-VariableFont_wght.ttf',
  variable: '--font-onest',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Espace',
  description: 'Platformă pentru administrarea A.P.C. și condominiilor din Republica Moldova.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://espace.md'),
  manifest: '/manifest.webmanifest',
  applicationName: 'Espace',
  openGraph: {
    title: 'Espace',
    description: 'Platformă pentru administrarea A.P.C. și condominiilor din Republica Moldova.',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Espace',
  },
  icons: {
    shortcut: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/pwa-192.svg' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro" className={onest.variable}>
      <body className="font-sans bg-background text-foreground antialiased">
        <AuthProvider>
          <BrandingProvider>
            <NextIntlClientProvider locale={defaultLocale} messages={roMessages}>
              <ThemeColorMeta />
              <ServiceWorkerRegister />
              <ClientErrorBoundary>
                <ToastProvider>{children}</ToastProvider>
              </ClientErrorBoundary>
            </NextIntlClientProvider>
          </BrandingProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
