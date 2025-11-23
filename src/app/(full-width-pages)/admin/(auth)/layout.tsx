"use client";

import dynamic from "next/dynamic";
import React, { Suspense } from "react";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import Image from "next/image";
import { Sun, Moon } from "lucide-react";

// Dynamically import GridShape (client‑only, no SSR) with no visible placeholder
const DynamicGridShape = dynamic(() => import("@/components/common/GridShape"), {
  ssr: false,
  loading: () => null,
});

function ThemeToggle() {
  const { toggleTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-all z-50 backdrop-blur-sm"
      aria-label="Toggle Theme"
    >
      {mounted && (resolvedTheme === "dark" ? (
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : (
        <Moon className="w-5 h-5 text-gray-700" />
      ))}
    </button>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col dark:bg-gray-900 sm:p-0">
          {/* Theme Toggle – top‑right */}
          <ThemeToggle />

          {children}

          {/* Right side – branding & lazy GridShape */}
          <div className="lg:w-1/2 w-full h-full bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
            <div className="relative flex items-center justify-center z-1">
              {/* Lazy‑loaded GridShape */}
              <Suspense fallback={null}>
                <DynamicGridShape />
              </Suspense>
              <div className="flex flex-col items-center max-w-xs">
                <Link href="/" className="block mb-4">
                  <div className="flex items-center gap-2">
                    {/* Oureum Logo Image */}
                    <Image
                      src="/images/logo/oureum-logo.png"
                      alt="Oureum Logo"
                      width={60}
                      height={60}
                      className="object-contain"
                      priority
                    />
                    {/* Text branding */}
                    <span className="text-4xl font-bold tracking-tight whitespace-nowrap">
                      <span className="text-[#D4AF37]">Oureum</span>{" "}
                      <span className="text-white">Admin</span>
                    </span>
                  </div>
                </Link>
                <p className="text-center text-gray-400 dark:text-white/60">
                  Internal tools for pricing, gold ledger, OUMG mint/burn ops, and admin workflows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
