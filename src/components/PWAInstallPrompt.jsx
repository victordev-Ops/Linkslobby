"use client";

import { useState, useEffect } from "react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("📱 Install prompt available");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Set up interval to show prompt every 1 minute (60000ms)
    const promptInterval = setInterval(() => {
      if (!isInstalled && deferredPrompt) {
        setShowPrompt(true);
        console.log("⏰ Showing install prompt (1 minute interval)");
      }
    }, 60000); // 1 minute

    // Show initial prompt after 5 seconds
    const initialTimeout = setTimeout(() => {
      if (!isInstalled && deferredPrompt) {
        setShowPrompt(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearInterval(promptInterval);
      clearTimeout(initialTimeout);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log("❌ No install prompt available");
      return;
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;

      console.log(`User response: ${outcome}`);

      if (outcome === "accepted") {
        console.log("✅ User accepted the install prompt");
        setIsInstalled(true);
      } else {
        console.log("❌ User dismissed the install prompt");
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error("Error during installation:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    console.log("🚫 User dismissed prompt (will show again in 1 minute)");
  };

  if (!mounted || isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <span className="text-3xl">🎭</span>
            </div>
            <div>
              <h3 className="font-bold text-lg">Install Say App</h3>
              <p className="text-sm text-purple-100">Get the full experience</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="space-y-2 mb-4 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            <span>Instant notifications for new confessions</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            <span>Works offline</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            <span>Faster loading times</span>
          </li>
        </ul>

        <div className="flex gap-3">
          <button
            onClick={handleInstallClick}
            className="flex-1 bg-white text-purple-600 font-semibold py-3 px-4 rounded-lg hover:bg-purple-50 transition-colors"
          >
            Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-white/90 hover:text-white transition-colors font-medium"
          >
            Later
          </button>
        </div>

        <p className="text-xs text-purple-200 mt-3 text-center">
          Free • No download required • 1MB
        </p>
      </div>
    </div>
  );
}
