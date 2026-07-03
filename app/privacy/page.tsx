"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const LAST_UPDATED = "July 4, 2026"

const SECTIONS = [
  {
    title: "1. Information we collect",
    body: `We collect information you provide directly, such as your email, username, and profile details, along with content you send or receive through the app. We also collect limited technical data like device type and app usage to keep the service reliable.`,
  },
  {
    title: "2. How we use your information",
    body: `We use your information to operate and improve the app, deliver notifications you've opted into, process subscription payments, enforce our Terms of Use, and respond to support requests.`,
  },
  {
    title: "3. What we don't do",
    body: `We don't sell your personal information to third parties. We don't share your private messages with advertisers.`,
  },
  {
    title: "4. Sharing with service providers",
    body: `We work with third-party providers for things like payment processing, push notifications, and hosting. These providers only receive the information needed to perform their function and are bound to protect it.`,
  },
  {
    title: "5. Your controls",
    body: `You can update your profile, manage notification preferences, block or filter senders, and download or delete your account data at any time from Settings.`,
  },
  {
    title: "6. Data retention",
    body: `We retain your data while your account is active. When you delete your account, we remove or anonymize your personal data, except where we're required to retain it for legal or safety reasons.`,
  },
  {
    title: "7. Security",
    body: `We use industry-standard measures to protect your data, but no method of transmission or storage is 100% secure, and we can't guarantee absolute security.`,
  },
  {
    title: "8. Children's privacy",
    body: `This app is not intended for children under the minimum age required in your country, and we do not knowingly collect data from children below that age.`,
  },
  {
    title: "9. Changes to this policy",
    body: `We may update this policy from time to time. We'll notify you of material changes through the app.`,
  },
  {
    title: "10. Contact",
    body: `Questions about this policy can be sent through the "I need help" option in Settings.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0a1e] transition-colors duration-300 pb-16">
      <div className="fixed inset-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="bg-white/80 dark:bg-[#1a1429]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/10 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white active:scale-90 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Privacy policy</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 relative z-10">
        <p className="text-xs text-gray-400 dark:text-white/30 font-semibold">Last updated: {LAST_UPDATED}</p>

        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] divide-y divide-gray-100 dark:divide-white/[0.06] overflow-hidden">
          {SECTIONS.map(section => (
            <div key={section.title} className="px-4 py-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{section.title}</h2>
              <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-white/25 text-center leading-relaxed px-2">
          This is placeholder legal text. Replace it with a policy reviewed by qualified legal counsel before
          publishing to production.
        </p>
      </div>
    </div>
  )
}
