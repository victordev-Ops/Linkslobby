"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Keep in sync with manifest.ts background_color/theme_color — the native
// Android/PWA install splash renders the same icon on this same flat color
// right before this component ever mounts, so this first frame needs to be
// indistinguishable from that: same icon, same size class, same position,
// no gradient/animation yet. Otherwise the two splashes visibly "swap"
// instead of reading as one continuous screen.
const DARK_BG = "#0f0a1e";
const BRAND = "#9333EA";

export default function AppSplash({ show }: { show: boolean }) {
  // The native splash already showed a static icon centered on DARK_BG.
  // Mount our icon in that exact same state (full size, full opacity, no
  // motion) for one frame, then ease the loader ring/glow/label in around
  // it — the icon itself never moves or re-animates, so there's nothing to
  // visually "hand off."
  const [chromeIn, setChromeIn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(() => setChromeIn(true), 40);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="app-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[999] overflow-hidden"
          style={{ background: DARK_BG }}
        >
          {/* ambient glow — fades in after the first frame, never present at hand-off */}
          <motion.div
            className="absolute -top-1/4 -left-1/4 w-[560px] h-[560px] rounded-full bg-purple-700/25 blur-[120px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: chromeIn ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 w-[520px] h-[520px] rounded-full bg-indigo-700/20 blur-[120px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: chromeIn ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          />

          {/* icon pinned at true viewport center, independent of the ring/label
              below — nothing in this tree pushes it off-center or resizes it */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-[112px] h-[112px] flex items-center justify-center">
              <motion.svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: chromeIn ? 1 : 0, rotate: chromeIn ? 360 : 0 }}
                transition={{
                  opacity: { duration: 0.5 },
                  rotate: { duration: 1.1, repeat: Infinity, ease: "linear" },
                }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke={BRAND}
                  strokeOpacity={0.9}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="74 210"
                />
              </motion.svg>

              {/* the icon itself: identical size/position from frame 1 onward,
                  only its subtle breathing scale is deferred until chromeIn */}
              <motion.img
                src="/icon-master-transparent-1024x1024.png"
                alt="Linkslobby"
                width={80}
                height={80}
                className="relative drop-shadow-[0_0_18px_rgba(147,51,234,0.55)]"
                initial={false}
                animate={chromeIn ? { scale: [0.97, 1, 0.97] } : { scale: 1 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: chromeIn ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-6 text-center text-white/40 text-[11px] font-semibold tracking-[0.2em] uppercase"
            >
              Linkslobby
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
