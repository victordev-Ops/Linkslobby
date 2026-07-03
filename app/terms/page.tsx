"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const LAST_UPDATED = "July 4, 2026"

const SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: `By creating an account or using this app, you agree to these Terms of Use. If you don't agree, please don't use the service. We may update these terms from time to time, and continued use after changes means you accept the updated terms.`,
  },
  {
    title: "2. Who can use this app",
    body: `You must meet the minimum age required in your country to use this service, and you must provide accurate information when creating your account. You're responsible for keeping your login credentials secure.`,
  },
  {
    title: "3. Acceptable use",
    body: `You agree not to use the app to harass, threaten, or harm others; send spam or unsolicited content; impersonate someone else; upload unlawful, hateful, or sexually explicit material involving minors; or attempt to interfere with the app's normal operation. We may remove content or suspend accounts that violate these rules.`,
  },
  {
    title: "4. Your content",
    body: `You retain ownership of the content you post. By posting, you grant us a license to host, display, and distribute that content as needed to operate the app. You're responsible for making sure you have the rights to anything you share.`,
  },
  {
    title: "5. Subscriptions & billing",
    body: `Paid plans renew automatically unless cancelled before the end of the current billing period. You can manage or cancel your subscription at any time from your account settings. Refunds are handled according to the policy of the payment provider used at checkout.`,
  },
  {
    title: "6. Safety & moderation",
    body: `We provide tools to block, filter, and report content or users. We may investigate reports and take action, including removing content or suspending accounts, at our discretion.`,
  },
  {
    title: "7. Termination",
    body: `You may delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms or applicable law.`,
  },
  {
    title: "8. Disclaimers & liability",
    body: `The app is provided "as is" without warranties of any kind. To the extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the app.`,
  },
  {
    title: "9. Contact",
    body: `Questions about these terms can be sent through the "I need help" option in Settings.`,
  },
]

export default function TermsPage() {
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
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Terms of use</h1>
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
          This is placeholder legal text. Replace it with terms reviewed by qualified legal counsel before
          publishing to production.
        </p>
      </div>
    </div>
  )
  }
