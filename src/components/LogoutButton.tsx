// src/components/LogoutButton.tsx
'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext' // Import useAuth

export default function LogoutButton() {
  const { signOut } = useAuth() // Use the centralized signOut function
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    
    // Call the context's signOut function, which handles the Supabase call, 
    // state clear, and redirect automatically via the listener.
    await signOut()

    // Safety fallback state reset
    setIsLoading(false)
    setShowConfirm(false)
  }

  const initiateLogout = () => {
    setShowConfirm(true)
  }

  const cancelLogout = () => {
    setShowConfirm(false)
  }

  return (
    <>
      <button
        onClick={initiateLogout}
        disabled={isLoading}
        aria-label="Log out"
        className="flex w-full items-center justify-center gap-3 rounded-lg px-6 py-3 text-left font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
      >
        <LogOut className="h-5 w-5" />
        Log out
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Confirm logout
            </h2>
            <p className="mb-6 text-gray-600">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelLogout}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isLoading ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
    }
          
