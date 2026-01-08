// app/dashboard/page.tsx
import DashboardClient from './DashboardClient'

// We removed the blocking server-side check (getUser and redirect)
// to prevent the client-side navigation stall.
// Middleware protects the route, and DashboardClient handles the rest.
export default async function DashboardPage() {
  return <DashboardClient />
}
