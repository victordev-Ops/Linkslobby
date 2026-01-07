import { AuthProvider } from '@/context/AuthContext'
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Everything inside children (Dashboard, AMA, etc.) can now use useAuth() */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
