import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { GeistSans, GeistMono } from "geist/font"
import "./globals.css"
import ClientLayout from "@/components/ClientLayout"
import { ThemeProvider } from "@/components/ThemeProvider"

const geistSans = GeistSans
const geistMono = GeistMono

// Keep in sync with LandingClient.tsx: purple-600 accent, #F8F9FD light /
// #0f0a1e dark surfaces, "Linkslobby" brand name and logo.
const BRAND_NAME = "Linkslobby"
const BRAND_TAGLINE = "Connect and Play"
const BRAND_DESCRIPTION =
  "Confessions, Truth or Dare, Hot Seat, and more — real games with the friends you already have. Every round earns you stars."
const BRAND_COLOR = "#9333EA" // Tailwind purple-600, matches CTA buttons on landing
const LIGHT_BG = "#F8F9FD"
const DARK_BG = "#0f0a1e"

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    siteName: BRAND_NAME,
    type: "website",
    // no `images` here — app/opengraph-image.tsx supplies this automatically
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    // no `images` here — app/opengraph-image.tsx supplies this automatically
  },
  // ... rest of metadata
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: LIGHT_BG },
    { media: "(prefers-color-scheme: dark)", color: DARK_BG },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // Ensure content extends to edges
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
 <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6982582921064240"
     crossorigin="anonymous"></script>
  <meta
  name="impact-site-verification"
  content="1ce85299-f0a8-4603-89ae-2dc158179031"
/>   
     <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'system';
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (theme === 'system' && systemDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={BRAND_NAME} />
        <meta name="theme-color" content={BRAND_COLOR} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <SpeedInsights />
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
