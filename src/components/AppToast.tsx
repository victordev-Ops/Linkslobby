"use client"

import { toast } from 'sonner'
import { X, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type AppToastVariant = 'default' | 'success' | 'error' | 'info' | 'warning' | 'xp'

interface ShowAppToastOptions {
  /**
   * Stable id for this notification, e.g. `message:${confessionId}`.
   * Passing the SAME id for the same underlying record means a re-fired
   * realtime event (debounce overlap, reconnect replay, dual-tab) updates
   * the existing toast in place instead of stacking a duplicate one on
   * top of it — this was the actual cause of toasts visually overlapping.
   * If omitted, a random id is generated (fine for one-off UI feedback).
   */
  id?: string
  icon?: LucideIcon
  variant?: AppToastVariant
  description?: ReactNode
  action?: { label: string; onClick: () => void }
  /** Override the icon chip color classes if the variant palette isn't right */
  accentClassName?: string
  duration?: number
}

const VARIANT_STYLES: Record<AppToastVariant, string> = {
  default: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400',
  success: 'text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400',
  error: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400',
  info: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400',
  warning: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
  // Matches XPBalance.tsx exactly (orange-600/400, filled star) so a Stars
  // toast reads as the same currency as the balance pill in the navbar —
  // not a generic amber "XP" notification.
  xp: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400',
}

/**
 * The single source of truth for every "event happened" toast in the app
 * (new message, turn events, friend requests, game invites, etc). Mirrors
 * the card layout from XPNotification.tsx so the amber XP toast and every
 * other toast in the app share one visual language.
 *
 * Renders through whatever <Toaster> is mounted — there must only ever be
 * ONE <Toaster> in the tree (see ClientLayout.tsx) or every toast renders
 * twice, which is what caused the overlap bug.
 */
export function showAppToast(title: string, options: ShowAppToastOptions = {}) {
  const {
    id,
    icon: Icon,
    variant = 'default',
    description,
    action,
    accentClassName,
    duration = 4500,
  } = options

  const toastId = id ?? Math.random().toString(36).slice(2, 9)
  const accent = accentClassName || VARIANT_STYLES[variant]

  toast.custom(
    (t) => (
      <div className="relative flex items-start gap-2.5 py-2 px-3 rounded-lg border shadow-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border-zinc-200/80 dark:border-white/10 w-[320px]">
        {Icon && (
          <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${accent}`}>
            <Icon className={`w-4 h-4 ${variant === 'xp' ? 'fill-orange-500 dark:fill-orange-400' : ''}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-snug truncate">{title}</p>
          {description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
          {action && (
            <button
              onClick={() => {
                action.onClick()
                toast.dismiss(t)
              }}
              className="mt-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => toast.dismiss(t)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 rounded shrink-0 mt-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    { id: toastId, duration }
  )

  return toastId
}

/** Thin success/error helpers for action-result feedback, same visual family. */
export function showAppSuccess(title: string, description?: string) {
  return showAppToast(title, { variant: 'success', description, duration: 3000 })
}

export function showAppError(title: string, description?: string) {
  return showAppToast(title, { variant: 'error', description, duration: 3000 })
}
