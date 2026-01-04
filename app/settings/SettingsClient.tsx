"use client"

import { useState, useEffect } from "react"
import LogoutButton from "@/components/LogoutButton"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { User, Mail, ArrowLeft, LogIn, Bug } from "lucide-react"
import PushToggle from "@/components/PushToggle"
import { createClient } from "@/lib/supabase/client"

interface SettingsClientProps {
  initialUser: any
  initialUsername: string
}

export default function SettingsClient({
  initialUser,
  initialUsername,
}: SettingsClientProps) {
  const [justLoggedOut, setJustLoggedOut] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const user = initialUser
  const username = initialUsername

  useEffect(() => {
    if (searchParams.get("loggedOut") === "true") {
      setJustLoggedOut(true)
      router.replace('/settings', { scroll: false })
    }
  }, [searchParams, router])

  // Debug function
  const runDiagnostics = async () => {
    const info: any = {
      timestamp: new Date().toISOString(),
      browser: {
        hasNotification: "Notification" in window,
        hasServiceWorker: "serviceWorker" in navigator,
        notificationPermission: "Notification" in window ? Notification.permission : "N/A"
      },
      environment: {
        hasVapidKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        vapidKeyLength: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length || 0
      }
    }

    // Check service worker
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        info.serviceWorker = {
          active: !!registration.active,
          scope: registration.scope,
          hasPushManager: "pushManager" in registration
        }

        // Check push subscription
        const subscription = await registration.pushManager.getSubscription()
        info.pushSubscription = {
          exists: !!subscription,
          endpoint: subscription?.endpoint?.substring(0, 50) + "..." || "N/A"
        }
      } catch (err: any) {
        info.serviceWorkerError = err.message
      }
    }

    // Check database
    if (user) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("push_subscription")
          .eq("id", user.id)
          .single()

        info.database = {
          hasSubscription: !!data?.push_subscription,
          subscriptionLength: data?.push_subscription ? JSON.stringify(data.push_subscription).length : 0,
          error: error?.message || null
        }
      } catch (err: any) {
        info.databaseError = err.message
      }
    }

    setDebugInfo(info)
  }

  // Test notification function
  const testNotification = async () => {
    if (!user) {
      alert("You must be logged in to test notifications")
      return
    }

    try {
      const res = await fetch('/api/webhooks/confession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            profile_id: user.id,
            message: 'Test notification from settings! 🔔',
            created_at: new Date().toISOString()
          }
        })
      })

      const data = await res.json()
      alert(`Response: ${JSON.stringify(data, null, 2)}`)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Message after Logout */}
      {justLoggedOut && (
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-center font-medium">
            You have been successfully logged out.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-bold flex-1">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Settings Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-gray-600" />
                Profile
              </h2>
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {user ? username : "Guest"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {user ? "Your display name" : "Log in to customize your profile"}
                </p>
              </div>
            </div>

            {/* Notifications Card */}
            {user && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-gray-600" />
                  Notifications
                </h2>
                <PushToggle userId={user.id} />
              </div>
            )}

            {/* Debug Panel - NEW */}
            {user && (
              <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-900">
                  <Bug className="h-5 w-5" />
                  Debug Tools
                </h2>
                
                <div className="space-y-3">
                  <button
                    onClick={runDiagnostics}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Run Diagnostics
                  </button>

                  <button
                    onClick={testNotification}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    🧪 Test Push Notification
                  </button>

                  {debugInfo && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                      <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(debugInfo, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-600" />
                Account
              </h2>
              <div className="space-y-6">
                {user ? (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{user.email}</p>
                    </div>
                    <div className="pt-4 border-t">
                      <LogoutButton />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-6">
                      Log in to access your account settings
                    </p>
                    <Link href="/login">
                      <button className="flex w-full items-center justify-center gap-3 rounded-lg px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <LogIn className="h-5 w-5" />
                        Log in
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Future Settings Teaser */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-3">More coming soon</h2>
              <p className="text-sm text-gray-600">
                We're working on adding preferences for appearance (dark mode), privacy controls, and more.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h3 className="font-medium text-gray-900 mb-3">Quick links</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/dashboard" className="text-purple-600 hover:underline">
                    Dashboard
                  </Link>
                </li>
                <li className="text-gray-500">Appearance (soon)</li>
                <li className="text-gray-500">Privacy (soon)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mobile-only back button */}
        <div className="fixed bottom-6 left-6 right-6 sm:hidden">
          <Link
            href="/dashboard"
            className="w-full bg-white shadow-lg rounded-xl px-6 py-4 flex items-center justify-center gap-2 font-medium text-gray-900 border border-gray-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
          }
