"use client"

import { XPNotificationToast, useXPNotifications } from './XPNotification'

export function XPNotificationProvider({ children }: { children: React.ReactNode }) {
  const notification = useXPNotifications()

  return (
    <>
      {children}
      <XPNotificationToast
        show={!!notification}
        amount={notification?.amount || 0}
        reason={notification?.reason || ''}
      />
    </>
  )
}
