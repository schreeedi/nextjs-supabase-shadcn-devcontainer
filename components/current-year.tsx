"use client";

// Static pages are prerendered at build time; a server-rendered year would
// stay frozen until the next build. The client fills in the current year.
// suppressHydrationWarning: the build-time year may differ — that's the point.
export function CurrentYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
