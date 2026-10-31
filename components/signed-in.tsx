"use client";

import { useSyncExternalStore } from "react";

// Display-only login hint for static (marketing) pages: is there a Supabase
// session cookie? Lets "/" stay statically rendered instead of calling the
// auth server on every visit. NOT an auth check — /app is protected by the
// proxy, and an expired cookie only shows "Dashboard" one click too early.
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

function hasSessionCookie() {
  return SESSION_COOKIE.test(document.cookie);
}

const subscribe = () => () => {};

/** Server and first client render: signed out (no hydration mismatch). */
export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, hasSessionCookie, () => false);
}

/** Renders `signedIn` or `signedOut` depending on the session cookie. */
export function SignedInSwitch({
  signedIn,
  signedOut,
}: {
  signedIn: React.ReactNode;
  signedOut: React.ReactNode;
}) {
  return useSignedIn() ? signedIn : signedOut;
}
