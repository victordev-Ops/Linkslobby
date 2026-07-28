import type { Metadata } from "next"
import Link from "next/link"
import { Space_Grotesk, Inter } from "next/font/google"
import { ArrowLeft, Mail } from "lucide-react"

// Same two-role type system as the rest of the app: Space Grotesk for
// personality (headings), Inter for quiet, legible body copy.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Terms of Service | Linkslobby",
  description:
    "The terms that govern your use of Linkslobby — Confessions, Anonymous Messages, Truth or Dare, Hot Seat, RPSArena, and more.",
}

const LAST_UPDATED = "July 28, 2026"
const SUPPORT_EMAIL = "hello@linkslobby.com"

const SECTIONS = [
  { id: "eligibility", title: "1. Eligibility" },
  { id: "account", title: "2. Your Account" },
  { id: "service", title: "3. Description of the Service" },
  { id: "content", title: "4. User Content" },
  { id: "stars", title: "5. Stars & XP" },
  { id: "pro", title: "6. Linkslobby Pro" },
  { id: "prohibited", title: "7. Prohibited Conduct" },
  { id: "ip", title: "8. Intellectual Property" },
  { id: "ip-complaints", title: "9. IP Complaints" },
  { id: "privacy", title: "10. Privacy" },
  { id: "third-party", title: "11. Third-Party Services" },
  { id: "disclaimers", title: "12. Disclaimers" },
  { id: "liability", title: "13. Limitation of Liability" },
  { id: "indemnification", title: "14. Indemnification" },
  { id: "termination", title: "15. Termination" },
  { id: "changes", title: "16. Changes to the Service and Terms" },
  { id: "governing-law", title: "17. Governing Law & Disputes" },
  { id: "general", title: "18. General Provisions" },
] as const

export default function TermsPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen bg-white dark:bg-[#0f0a1a] text-slate-900 dark:text-white/90`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-100 dark:border-white/10 bg-white/80 dark:bg-[#0f0a1a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-white/50 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Linkslobby
          </Link>
          <span
            className="text-sm font-semibold text-purple-600 dark:text-purple-400"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Linkslobby
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
        {/* Sidebar nav — desktop only */}
        <nav className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
            On this page
          </p>
          <ul className="space-y-1.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block text-slate-500 dark:text-white/50 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="min-w-0">
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-white/40">
            Last updated: {LAST_UPDATED}
          </p>

          <p className="mt-6 text-[15px] leading-relaxed text-slate-600 dark:text-white/70">
            These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) are a
            legal agreement between you (&ldquo;<strong>you</strong>&rdquo; or
            &ldquo;<strong>User</strong>&rdquo;) and Linkslobby (&ldquo;
            <strong>Linkslobby</strong>,&rdquo; &ldquo;<strong>we</strong>,
            &rdquo; &ldquo;<strong>us</strong>,&rdquo; or &ldquo;
            <strong>our</strong>&rdquo;), governing your access to and use of
            the Linkslobby website, mobile experiences, and related services,
            including Confessions, Anonymous Messages, Truth or Dare, Do You
            Know Me?, Ask Me Anything, Hot Seat, RPSArena, and any other game,
            feature, or service we operate under the Linkslobby brand
            (collectively, the &ldquo;<strong>Service</strong>&rdquo;).
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-white/70">
            By creating an account, accessing, or using the Service, you
            agree to be bound by these Terms. If you do not agree, do not use
            the Service.
          </p>

          <Section id="eligibility" title="1. Eligibility">
            <Prose>
              You must be at least <strong>13 years old</strong> to create an
              account or use the Service. If you are between 13 and 18 years
              old (or the age of legal majority in your jurisdiction, if
              higher), you may only use the Service with the involvement and
              consent of a parent or legal guardian, who agrees to be bound
              by these Terms on your behalf.
            </Prose>
            <Prose>
              By using the Service, you represent that you meet these
              eligibility requirements and that all registration information
              you submit is accurate and truthful. We reserve the right to
              request age verification and to suspend or terminate accounts
              that we believe belong to users who do not meet these
              requirements.
            </Prose>
          </Section>

          <Section id="account" title="2. Your Account">
            <Prose>
              You must register for an account to access most features of
              the Service. You agree to provide accurate, current, and
              complete information and to keep it up to date.
            </Prose>
            <Prose>
              You are responsible for maintaining the confidentiality of your
              login credentials and for all activity that occurs under your
              account. Notify us immediately at{" "}
              <EmailLink /> if you suspect unauthorized use of your account.
            </Prose>
            <Prose>
              You may not create an account on behalf of someone else without
              their permission, impersonate any person or entity, or
              misrepresent your affiliation with a person or entity. We may
              suspend, restrict, or terminate any account that violates these
              Terms, poses a security risk, or is inactive for an extended
              period.
            </Prose>
          </Section>

          <Section id="service" title="3. Description of the Service">
            <Prose>
              Linkslobby is a social platform combining anonymous social
              features (such as Confessions, Anonymous Messages, and Ask Me
              Anything) with live and asynchronous social games (such as
              Truth or Dare, Do You Know Me?, Hot Seat, and RPSArena).
              Features, games, and functionality may change, be added, or be
              removed at our discretion at any time, with or without notice.
            </Prose>
          </Section>

          <Section id="content" title="4. User Content">
            <Prose>
              &ldquo;User Content&rdquo; means any text, messages,
              confessions, questions, answers, images, audio, usernames,
              profile information, or other material that you or other users
              submit, post, or transmit through the Service, including
              content submitted anonymously to you or by you to others.
            </Prose>
            <SubHeading>Ownership</SubHeading>
            <Prose>
              You retain ownership of the User Content you submit. By
              submitting User Content, you grant Linkslobby a worldwide,
              non-exclusive, royalty-free, sublicensable license to host,
              store, reproduce, display, transmit, and distribute that
              content solely to operate, provide, promote, and improve the
              Service.
            </Prose>
            <SubHeading>Anonymous content</SubHeading>
            <Prose>
              Content you receive anonymously reflects the views of the
              anonymous sender, not of Linkslobby. We do not guarantee the
              identity, accuracy, or intent of any anonymous sender. We may,
              but are not obligated to, retain technical information
              associated with anonymous submissions (such as timestamps or
              account metadata) for safety, moderation, legal compliance, or
              abuse-investigation purposes, even though this information is
              not shown to other users.
            </Prose>
            <SubHeading>Content standards</SubHeading>
            <Prose>You agree not to submit User Content that:</Prose>
            <List
              items={[
                "Is defamatory, obscene, pornographic, or sexually exploitative of any person, particularly minors",
                "Harasses, bullies, threatens, or incites violence against any individual or group",
                "Discloses another person's private information without consent (doxxing)",
                "Infringes any third party's intellectual property or other rights",
                "Is false, misleading, or intended to deceive",
                "Promotes illegal activity, self-harm, or extremism",
              ]}
            />
            <Prose>
              We may, but have no obligation to, monitor, review, remove, or
              restrict access to any User Content, and to suspend or
              terminate accounts, at our discretion, with or without notice.
              In-app tools let you report, block, or delete unwanted content
              and users — dismissing a notification about a message does not
              necessarily delete the underlying content or notify the
              sender.
            </Prose>
          </Section>

          <Section id="stars" title="5. Stars & XP">
            <Prose>
              The Service includes a virtual points system (&ldquo;
              <strong>Stars</strong>&rdquo; and/or &ldquo;
              <strong>XP</strong>&rdquo;) that can be earned through in-app
              activity or purchased with real currency through the Service.
            </Prose>
            <Prose>
              Stars and XP have <strong>no monetary value</strong>, are{" "}
              <strong>
                not redeemable or exchangeable for cash, cash equivalents, or
                any real-world currency or property
              </strong>
              , and cannot be transferred between accounts, sold, or traded
              outside the Service. They represent a limited, non-transferable,
              revocable license to access certain in-app features — not
              property or a stored-value account.
            </Prose>
            <Prose>
              Purchases of Stars are final. Except where required by
              applicable law, purchases are non-refundable, including where
              an account is suspended or terminated for violating these
              Terms. We may adjust, suspend, or discontinue the Stars/XP
              system, and may change how Stars and XP are earned, priced, or
              used, at any time. If you use a third-party payment processor
              to purchase Stars, your payment is also subject to that
              processor&rsquo;s terms and privacy policy.
            </Prose>
          </Section>

          <Section id="pro" title="6. Linkslobby Pro">
            <Prose>
              We may offer a paid subscription tier (&ldquo;
              <strong>Linkslobby Pro</strong>&rdquo;) that unlocks additional
              games, features, or a badge, as described in the Service at the
              time of purchase. Pricing, billing frequency, and included
              features are disclosed at checkout and may change with notice.
            </Prose>
            <Prose>
              Unless stated otherwise at checkout, subscriptions renew
              automatically until cancelled. You are responsible for
              cancelling before the renewal date to avoid further charges.
              Except where required by law, fees already charged are
              non-refundable.
            </Prose>
          </Section>

          <Section id="prohibited" title="7. Prohibited Conduct">
            <Prose>You agree not to:</Prose>
            <List
              items={[
                "Use the Service for any unlawful purpose or in violation of these Terms",
                "Harass, threaten, stalk, or abuse other users, including through anonymous features",
                "Attempt to unmask, identify, or de-anonymize another user without their consent",
                "Use bots, scripts, or automated means to access the Service, farm Stars/XP, or manipulate games",
                "Circumvent, disable, or interfere with security features, rate limits, or access controls",
                "Reverse-engineer, decompile, or attempt to extract the source code of the Service, except as permitted by law",
                "Use the Service to send spam, malware, or unsolicited commercial messages",
                "Create multiple accounts to evade a suspension or manipulate game outcomes, leaderboards, or Stars/XP balances",
                "Sell, rent, or transfer your account or Stars/XP to another person",
              ]}
            />
            <Prose>
              Violation of this section may result in immediate suspension or
              termination of your account, in addition to any other remedies
              available to us.
            </Prose>
          </Section>

          <Section id="ip" title="8. Intellectual Property">
            <Prose>
              The Service, including its software, design, graphics, logos,
              the &ldquo;Linkslobby&rdquo; name and marks, and all related
              intellectual property, is owned by Linkslobby or its licensors
              and is protected by applicable intellectual property laws.
            </Prose>
            <Prose>
              Subject to your compliance with these Terms, we grant you a
              limited, non-exclusive, non-transferable, revocable license to
              access and use the Service for your personal, non-commercial
              use. You may not copy, modify, distribute, sell, or lease any
              part of the Service, nor reverse-engineer or attempt to extract
              its source code, except as permitted by applicable law.
            </Prose>
          </Section>

          <Section id="ip-complaints" title="9. Intellectual Property Complaints">
            <Prose>
              If you believe content on the Service infringes your
              intellectual property rights, send a notice to <EmailLink />{" "}
              including: (a) identification of the work claimed to be
              infringed; (b) identification of the allegedly infringing
              material and its location on the Service; (c) your contact
              information; and (d) a statement of good-faith belief that the
              use is unauthorized. We may remove or disable access to
              reported content and may terminate accounts of repeat
              infringers.
            </Prose>
          </Section>

          <Section id="privacy" title="10. Privacy">
            <Prose>
              Our collection and use of personal information is described in
              our Privacy Policy, which is incorporated into these Terms by
              reference. By using the Service, you consent to that
              collection and use.
            </Prose>
          </Section>

          <Section id="third-party" title="11. Third-Party Services">
            <Prose>
              The Service may link to or integrate with third-party services
              (such as payment processors or authentication providers). We
              are not responsible for the content, policies, or practices of
              third-party services, and your use of them is at your own risk
              and subject to their own terms.
            </Prose>
          </Section>

          <Section id="disclaimers" title="12. Disclaimers">
            <Prose>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER
              EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THAT THE
              SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </Prose>
            <Prose>
              We do not endorse, verify, or take responsibility for User
              Content, including anonymous submissions, and are not liable
              for any reliance you place on such content. Nothing in this
              section limits any warranty or right that cannot be excluded
              under applicable Nigerian law, including the Federal
              Competition and Consumer Protection Act.
            </Prose>
          </Section>

          <Section id="liability" title="13. Limitation of Liability">
            <Prose>
              To the maximum extent permitted by applicable law, Linkslobby,
              its officers, employees, and affiliates will not be liable for
              any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits, data, goodwill, or Stars/XP
              balance, arising from or related to your use of the Service,
              even if advised of the possibility of such damages. Our total
              aggregate liability for any claim arising from these Terms or
              the Service will not exceed the greater of (a) the amount you
              paid us in the twelve (12) months preceding the claim, or (b)
             NGN 10,000.
            </Prose>
            <Prose>
              This section does not limit liability for death, personal
              injury caused by negligence, fraud, or any liability that
              cannot be excluded under Nigerian law.
            </Prose>
          </Section>

          <Section id="indemnification" title="14. Indemnification">
            <Prose>
              You agree to indemnify and hold harmless Linkslobby and its
              officers, employees, and affiliates from any claims, damages,
              losses, and expenses (including reasonable legal fees) arising
              from your use of the Service, your User Content, or your
              violation of these Terms or applicable law.
            </Prose>
          </Section>

          <Section id="termination" title="15. Termination">
            <Prose>
              You may stop using the Service or delete your account at any
              time. We may suspend or terminate your access to the Service,
              with or without notice, if we believe you have violated these
              Terms, engaged in fraudulent or abusive conduct, or if required
              by law.
            </Prose>
            <Prose>
              Upon termination, your license to use the Service ends
              immediately. Sections that by their nature should survive
              termination (including User Content ownership and licensing,
              Stars/XP terms, Intellectual Property, Disclaimers, Limitation
              of Liability, Indemnification, and Governing Law) will survive.
            </Prose>
          </Section>

          <Section id="changes" title="16. Changes to the Service and Terms">
            <Prose>
              We may modify these Terms from time to time. If we make
              material changes, we will provide notice (such as through the
              Service or by email) before the changes take effect. Continued
              use of the Service after changes take effect constitutes
              acceptance of the revised Terms. We may also modify, suspend,
              or discontinue any part of the Service at any time.
            </Prose>
          </Section>

          <Section id="governing-law" title="17. Governing Law & Disputes">
            <Prose>
              These Terms are governed by the laws of the{" "}
              <strong>Federal Republic of Nigeria</strong>, without regard to
              conflict-of-law principles.
            </Prose>
            <Prose>
              Any dispute arising out of or relating to these Terms or the
              Service shall first be addressed through good-faith
              negotiation. If unresolved within thirty (30) days, the
              dispute shall be submitted to the exclusive jurisdiction of a
              court in Nigeria.
            </Prose>
          </Section>

          <Section id="general" title="18. General Provisions">
            <SubHeading>Entire agreement</SubHeading>
            <Prose>
              These Terms, together with our Privacy Policy, constitute the
              entire agreement between you and Linkslobby regarding the
              Service.
            </Prose>
            <SubHeading>Severability</SubHeading>
            <Prose>
              If any provision of these Terms is found unenforceable, the
              remaining provisions will remain in full effect.
            </Prose>
            <SubHeading>No waiver</SubHeading>
            <Prose>
              Our failure to enforce any right or provision of these Terms is
              not a waiver of that right or provision.
            </Prose>
            <SubHeading>Assignment</SubHeading>
            <Prose>
              You may not assign these Terms without our consent. We may
              assign these Terms in connection with a merger, acquisition, or
              sale of assets.
            </Prose>
            <SubHeading>Contact</SubHeading>
            <Prose>
              Questions about these Terms can be sent to <EmailLink />.
            </Prose>
          </Section>

          <div className="mt-14 pt-8 border-t border-slate-100 dark:border-white/10 flex items-start gap-3 rounded-2xl bg-purple-50/60 dark:bg-purple-500/10 p-5">
            <Mail size={18} className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 dark:text-white/60">
              By using Linkslobby, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service.
              Questions? Reach us at <EmailLink />.
              <br/>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2
        className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
      {children}
    </h3>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-slate-600 dark:text-white/70">
      {children}
    </p>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-[15px] leading-relaxed text-slate-600 dark:text-white/70">
          {item}
        </li>
      ))}
    </ul>
  )
}

function EmailLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="font-medium text-purple-600 dark:text-purple-400 hover:underline"
    >
      {SUPPORT_EMAIL}
    </a>
  )
}
