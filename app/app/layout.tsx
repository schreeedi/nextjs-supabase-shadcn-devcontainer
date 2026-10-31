import type { Metadata } from "next";

// Signed-in area: never indexed (robots.ts also disallows /app/).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
