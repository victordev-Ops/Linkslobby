"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Shield,
  UserX,
  Filter,
  Eye,
  AlertTriangle,
  MessageCircleWarning,
  Phone,
  Mail,
  FileText,
} from "lucide-react"

const SUPPORT_EMAIL = "hello@linkslobby.com"

// ── Reusable page shell (mirrors SettingsClient header/ambient styling) ─────
function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
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
          <h1 className="font-bold text-gray-900 dark:text-white text-base">{title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">{children}</div>
    </div>
  )
}

function ResourceCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  description: string
  href?: string
}) {
  const content = (
    <div className="flex items-start gap-3.5 px-4 py-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{title}</p>
        <p className="text-xs text-gray-400 dark:text-white/35 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="block hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
        {content}
      </Link>
    )
  }
  return content
}

export default function SafetyPage() {
  return (
    <PageShell title="Safety resources">
      <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-4">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center mb-3">
          <Shield size={18} />
        </div>
        <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">
          Your safety comes first. This page collects the tools you have to control your experience,
          plus where to go if something feels wrong.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
          Tools you control
        </p>
        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
          <ResourceCard
            icon={<Filter size={16} />}
            iconBg="bg-orange-100 dark:bg-orange-500/20"
            iconColor="text-orange-600 dark:text-orange-400"
            title="Hidden words"
            description="Automatically blur messages containing words you'd rather not see."
            href="/settings"
          />
          <ResourceCard
            icon={<UserX size={16} />}
            iconBg="bg-red-100 dark:bg-red-500/20"
            iconColor="text-red-600 dark:text-red-400"
            title="Block users & senders"
            description="Stop anyone — including anonymous senders — from reaching you."
            href="/settings"
          />
          <ResourceCard
            icon={<Eye size={16} />}
            iconBg="bg-slate-100 dark:bg-white/10"
            iconColor="text-slate-600 dark:text-white/60"
            title="Watermarking"
            description="Pro members can control whether shared content carries a watermark."
            href="/settings"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2 px-1">
          If something&rsquo;s wrong
        </p>
        <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
          <ResourceCard
            icon={<MessageCircleWarning size={16} />}
            iconBg="bg-teal-100 dark:bg-teal-500/20"
            iconColor="text-teal-600 dark:text-teal-400"
            title="Report a message or user"
            description="Use the report option on any message or profile to flag it to our team for review."
          />
          <ResourceCard
            icon={<AlertTriangle size={16} />}
            iconBg="bg-amber-100 dark:bg-amber-500/20"
            iconColor="text-amber-600 dark:text-amber-400"
            title="Contact support"
            description="Reach our team directly for anything urgent or unresolved."
            href="/help"
          />
          <ResourceCard
            icon={<Mail size={16} />}
            iconBg="bg-indigo-100 dark:bg-indigo-500/20"
            iconColor="text-indigo-600 dark:text-indigo-400"
            title="Email us directly"
            description={SUPPORT_EMAIL}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
        </div>
      </div>

      {/* Illegal content / CSAM — a zero-tolerance statement belongs on every
          safety page for a platform with anonymous or minor-accessible
          messaging, independent of the general report flow above. */}
      <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/30 mb-2">
          Illegal content
        </p>
        <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">
          We have zero tolerance for content that sexually exploits or endangers minors, or any other
          illegal content. Report it immediately using the in-app report option or by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-medium hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . We remove violating content and accounts on discovery and cooperate with law enforcement
          and legally mandated reporting bodies as required by law.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1a1429]/70 dark:backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/[0.08] p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
          <Phone size={16} />
        </div>
        <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">
          If you or someone else is in immediate danger, contact local emergency services right away.
          This app is not a substitute for emergency help.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 pt-1">
        <Link
          href="/terms"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-white/30 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <FileText size={12} />
          Terms of Service
        </Link>
        <span className="text-gray-200 dark:text-white/10">•</span>
        <Link
          href="/privacy"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-white/30 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <FileText size={12} />
          Privacy Policy
        </Link>
      </div>
    </PageShell>
  )
}
