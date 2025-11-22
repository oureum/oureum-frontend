/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/(user)/user/login/page.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  loginAndEnsureUser,
  setStoredUserWallet,
  clearStoredUserWallet,
} from "@/lib/apiUser";
import { useRouter } from "next/navigation";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";

export default function UserLoginPage() {
  const router = useRouter();
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
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-6 py-10 dark:bg-gray-900">
      {/* Theme Toggle - Top Right */}
      <div className="absolute right-6 top-6">
        <ThemeToggleButton />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900/50 dark:backdrop-blur-sm">

        {/* Logo Section */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 dark:bg-white/5">
            {/* Using a generic logo placeholder if specific one isn't confirmed, 
                 but I'll try to use one from the directory if I see it in the next step. 
                 For now, I'll use a text fallback or the Oureum 'O' style if no image.
                 Actually, I'll wait for the list_dir result to pick the image. 
                 I'll put a placeholder here and update it in a second pass if needed, 
                 or just use the text logo style from the website. 
                 Let's stick to a clean text/icon for now to be safe. */}
            <span className="text-3xl font-bold text-brand-500 dark:text-white">O</span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Connect your wallet to access the Oureum Dashboard
          </p>
        </div>

        {errorText && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
            {errorText}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={onConnect}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600 hover:shadow-brand-500/30 disabled:opacity-70 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 14C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12C15.4477 12 15 12.4477 15 13C15 13.5523 15.4477 14 16 14Z" fill="currentColor" />
                </svg>
                Connect MetaMask
              </>
            )}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          By connecting, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}