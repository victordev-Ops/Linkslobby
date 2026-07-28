"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const LAST_UPDATED = "July 28, 2026"
const SUPPORT_EMAIL = "hello@linkslobby.com"

const SECTIONS = [
  {
    title: "1. Who this policy covers",
    body: `This policy explains how Linkslobby ("we," "us," "our") collects, uses, shares, and protects your information when you use the Linkslobby website, mobile experiences, and games — including Confessions, Anonymous Messages, Truth or Dare, Do You Know Me?, Ask Me Anything, Hot Seat, and RPSArena (together, the "Service"). It applies to everyone who uses the Service, wherever you're located.`,
  },
  {
    title: "2. Information we collect",
    body: `Account information: your email, username, password (stored encrypted), profile details, and avatar.
Content: messages, confessions, questions, answers, and other content you send or receive through the app, including content sent to you anonymously.
Purchases: records of Stars/XP purchases and Linkslobby Pro subscription status. Payment card details are collected and processed directly by our payment processor — we don't store full card numbers.
Technical data: device type, operating system, app version, IP address, and usage data (such as which features you open and how often), collected to keep the Service reliable and secure.
Anonymous-feature metadata: for features like Confessions and Anonymous Messages, we retain limited technical information about the sender (such as account ID and timestamp) even though this isn't shown to the recipient. We use this only for safety, moderation, abuse investigation, and legal compliance — never to reveal a sender's identity to other users except where required by law or our Terms.`,
  },
  {
    title: "3. How we use your information",
    body: `We use your information to: operate, maintain, and improve the Service; personalize your experience and game recommendations; process Stars/XP purchases and Pro subscriptions; send notifications you've opted into; detect, investigate, and prevent fraud, abuse, and violations of our Terms of Service; respond to support requests; and comply with legal obligations.`,
  },
  {
    title: "4. Legal basis for processing",
    body: `Where applicable law requires a legal basis (including Nigeria's Data Protection Act, 2023), we process your information on the basis of: performing our contract with you (running your account and the Service), our legitimate interests (keeping the Service safe, functional, and improving it), your consent (such as optional notifications), and compliance with legal obligations.`,
  },
  {
    title: "5. What we don't do",
    body: `We don't sell your personal information. We don't share the content of your private messages, confessions, or anonymous submissions with advertisers or data brokers. We don't use the content of your messages to build advertising profiles.`,
  },
  {
    title: "6. Sharing with service providers",
    body: `We share limited information with third-party providers who perform services on our behalf, including cloud hosting and database infrastructure, payment processing, and push notification delivery. These providers only receive the information needed to perform their function, are contractually bound to protect it, and are not permitted to use it for their own purposes. Some providers may process or store data outside Nigeria; where that happens, we take steps to ensure the transfer is protected by appropriate safeguards, such as contractual data protection commitments.`,
  },
  {
    title: "7. Sharing for legal and safety reasons",
    body: `We may disclose information if required by law, court order, or governmental request, or where we believe in good faith that disclosure is necessary to protect the rights, property, or safety of Linkslobby, our users, or the public — including investigating fraud, harassment, or other Terms of Service violations.`,
  },
  {
    title: "8. Your rights and controls",
    body: `You can update your profile, manage notification preferences, block or filter senders, and download or delete your account data at any time from Settings. Depending on your location, you may also have the right to access, correct, delete, restrict, or port your personal data, and to object to certain processing. To exercise these rights, contact us using the details below. If you're not satisfied with our response, you may lodge a complaint with the Nigeria Data Protection Commission (NDPC) or your local data protection authority.`,
  },
  {
    title: "9. Data retention",
    body: `We retain your data while your account is active and for as long as needed to provide the Service. When you delete your account, we delete or anonymize your personal data within a reasonable period, except where we're required to retain it longer for legal, safety, tax, or dispute-resolution reasons.`,
  },
  {
    title: "10. Security",
    body: `We use industry-standard technical and organizational measures — including encryption in transit, access controls, and row-level security on our data infrastructure — to protect your data. No method of transmission or storage is 100% secure, and we can't guarantee absolute security. If we become aware of a data breach affecting your personal information, we'll notify you and any relevant authority as required by law.`,
  },
  {
    title: "11. Children's privacy",
    body: `The Service is intended for users aged 13 and older. If you're between 13 and 18, you may only use the Service with a parent or guardian's consent. We do not knowingly collect personal information from children under 13. If we learn we've collected such information, we'll delete it. Parents or guardians who believe we may have collected information from a child under 13 should contact us.`,
  },
  {
    title: "12. Cookies and similar technologies",
    body: `We use cookies and similar technologies to keep you signed in, remember your preferences, and understand how the Service is used. You can control cookies through your browser or device settings, though disabling them may limit some functionality.`,
  },
  {
    title: "13. International users",
    body: `Linkslobby is operated from Nigeria. If you use the Service from outside Nigeria, your information may be transferred to, stored, and processed in Nigeria or other countries where our service providers operate, which may have different data protection laws than your own.`,
  },
  {
    title: "14. Changes to this policy",
    body: `We may update this policy from time to time. If we make material changes, we'll notify you through the app or by email before they take effect. The "Last updated" date above reflects the most recent revision.`,
  },
  {
    title: "15. Contact us",
    body: `Questions, requests, or complaints about this policy or your data can be sent through the "I need help" option in Settings, or by emailing ${SUPPORT_EMAIL}.`,
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
              {section.body.split("\n").map((para, i) => (
                <p key={i} className="text-xs text-gray-500 dark:text-white/40 leading-relaxed mt-1.5 first:mt-0">
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-white/25 text-center leading-relaxed px-2">
          This policy is a working draft prepared for Linkslobby. Have it reviewed by qualified counsel
          familiar with the Nigeria Data Protection Act before relying on it in production.
        </p>
      </div>
    </div>
  )
}
