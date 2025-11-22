"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, Wallet } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  loginAndEnsureUser,
  setStoredUserWallet,
} from "@/lib/apiUser";

export default function UserLoginPage() {
  const router = useRouter();
  const { toggleTheme, resolvedTheme } = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function onConnect() {
    setLoading(true);
    setErrorText(null);
    try {
      const { wallet } = await loginAndEnsureUser();
      setStoredUserWallet(wallet);
      router.replace("/user");
    } catch (e) {
      setErrorText((e as Error)?.message || "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-all z-50"
        aria-label="Toggle Theme"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-700" />
        )}
      </button>

      {/* Background Effects (Dark Mode Only) */}
      <div className="absolute inset-0 z-0 opacity-0 dark:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D4AF37]/10 via-[#0a0a0a] to-[#0a0a0a]" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Brand / Title */}
        <div className="mb-8 text-center">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-medium tracking-wide">
            User Access
          </div>
          <h1 className="text-4xl font-bold tracking-tighter text-gray-900 dark:text-white mb-2">
            OUREUM <span className="text-[#D4AF37]">WALLET</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to manage assets
          </p>
        </div>

        {/* Login Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 shadow-xl backdrop-blur-sm">

          {errorText && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
              {errorText}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={onConnect}
              disabled={loading}
              className="group relative flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#D4AF37] text-white font-semibold shadow-lg shadow-[#D4AF37]/20 transition-all hover:bg-[#c4a030] hover:shadow-[#D4AF37]/30 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
            >
              {loading ? (
                <span>Connecting...</span>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            By connecting, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}