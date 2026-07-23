"use client";

import { AnimatePresence, motion } from "framer-motion";

// Keep in sync with layout.tsx / manifest.ts: #0f0a1e surface, #9333EA brand accent.
const DARK_BG = "#0f0a1e";
const BRAND = "#9333EA";

export default function AppSplash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="app-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden"
          style={{ background: DARK_BG }}
        >
          {/* ambient glow, matching the landing/OG treatment */}
          <div className="absolute -top-1/4 -left-1/4 w-[560px] h-[560px] rounded-full bg-purple-700/25 blur-[120px]" />
          <div className="absolute -bottom-1/4 -right-1/4 w-[520px] h-[520px] rounded-full bg-indigo-700/20 blur-[120px]" />

          <div className="relative flex flex-col items-center gap-7">
            {/* rotating arc loader, sized just past the logo so it doesn't crowd it */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <motion.svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={BRAND}
                  strokeOpacity={0.9}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="70 200"
                />
              </motion.svg>

              <motion.img
                src="/icon-master-transparent-1024x1024.png"
                alt="Linkslobby"
                width={56}
                height={56}
                className="relative drop-shadow-[0_0_18px_rgba(147,51,234,0.55)]"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: [0.96, 1, 0.96] }}
                transition={{
                  opacity: { duration: 0.4 },
                  scale: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
                }}
              />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-white/40 text-[11px] font-semibold tracking-[0.2em] uppercase"
            >
              Linkslobby
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
