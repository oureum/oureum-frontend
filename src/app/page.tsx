"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, User, Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function Home() {
  const { toggleTheme, resolvedTheme } = useTheme();

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">

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

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center">
        {/* Brand / Title */}
        <div className="mb-12">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-medium tracking-wide">
            Internal System
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-gray-900 dark:text-white mb-6">
            OUREUM <span className="text-[#D4AF37]">CORE</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Secure gateway for pricing oracles, gold ledger management, and OUMG mint/burn operations.
          </p>
        </div>

        {/* Actions Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Admin Portal Card */}
          <Link
            href="/admin/signin"
            className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 hover:border-[#D4AF37]/50 hover:shadow-lg dark:hover:bg-[#D4AF37]/5 transition-all duration-300 text-left"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="w-24 h-24 text-[#D4AF37]" />
            </div>
            <div className="relative z-10">
              <div className="h-12 w-12 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin Portal</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                Restricted access for system administrators. Requires hardware wallet signature.
              </p>
              <span className="inline-flex items-center text-[#D4AF37] font-medium group-hover:translate-x-2 transition-transform">
                Enter Portal <ArrowRight className="ml-2 w-4 h-4" />
              </span>
            </div>
          </Link>

          {/* User App Card */}
          <Link
            href="/user/login"
            className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-lg dark:hover:bg-white/10 transition-all duration-300 text-left"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <User className="w-24 h-24 text-gray-900 dark:text-white" />
            </div>
            <div className="relative z-10">
              <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <User className="w-6 h-6 text-gray-900 dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">User App</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                Client-facing dashboard for asset management and transfers.
              </p>
              <span className="inline-flex items-center text-gray-900 dark:text-white font-medium group-hover:translate-x-2 transition-transform">
                Launch App <ArrowRight className="ml-2 w-4 h-4" />
              </span>
            </div>
          </Link>
        </div>

        {/* Footnote */}
        <div className="mt-16 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-600">
          <div className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
          System Status: Operational
        </div>
      </div>
    </main>
  );
}