"use client";

import React from "react";
import { useRouter } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import { readAdminSession } from "@/lib/adminAuth";

/**
 * Admin Sign-in Page (Client Component)
 *
 * Behavior:
 * - On mount, checks if there is an existing admin session stored in localStorage.
 * - If a valid admin session exists, the user is immediately redirected
 *   to the dashboard route ("/" or "/admin", depending on your setup).
 * - If no valid session exists, the SignInForm (MetaMask login) is displayed.
 */
export default function Home() {
  // The session check and redirect are now handled within SignInForm.
  // We render SignInForm immediately so its internal loading state (Grey Box)
  // is visible during the initial load/SSR, preventing the "blank page" flash.
  return <SignInForm />;
}