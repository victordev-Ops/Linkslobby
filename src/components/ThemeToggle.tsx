"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Debug: Log current theme
    React.useEffect(() => {
        console.log('🎨 Current theme:', theme)

        // Check if dark class is actually on HTML
        const htmlElement = document.documentElement
        const hasDarkClass = htmlElement.classList.contains('dark')
        console.log('📋 HTML classList:', htmlElement.className)
        console.log('🌙 Has dark class:', hasDarkClass)
    }, [theme])

    if (!mounted) {
        return (
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full w-fit">
                <div className="w-8 h-8 rounded-full bg-transparent" />
                <div className="w-8 h-8 rounded-full bg-transparent" />
                <div className="w-8 h-8 rounded-full bg-transparent" />
            </div>
        )
    }

    const modes = [
        { name: 'light', icon: Sun },
        { name: 'dark', icon: Moon },
        { name: 'system', icon: Monitor },
    ]

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-full w-fit border border-transparent dark:border-white/10">
            {modes.map((mode) => {
                const Icon = mode.icon
                const isActive = theme === mode.name

                return (
                    <button
                        key={mode.name}
                        onClick={() => {
                            console.log('🔘 Clicked:', mode.name)
                            setTheme(mode.name)
                        }}
                        className={`
              relative p-2 rounded-full transition-all duration-200
              ${isActive
                                ? 'bg-white dark:bg-purple-600 shadow-sm text-purple-600 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }
            `}
                        aria-label={`Switch to ${mode.name} theme`}
                    >
                        <Icon size={16} strokeWidth={2.5} />
                    </button>
                )
            })}
        </div>
    )
}
