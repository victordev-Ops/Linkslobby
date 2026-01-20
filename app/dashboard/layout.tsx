import { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Middleware handles auth protection & profile completeness
  return <>{children}</>
}
