import { AuthCard } from "@/components/auth-card";
import { safeNextPath } from "@/lib/nav";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in" };

// Signed-in users never get here: the proxy redirects them away
// (utils/supabase/middleware.ts).
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your account to continue"
      alternate={{
        prompt: "Don't have an account?",
        label: "Sign up",
        href: "/signup",
      }}
      next={safeNextPath(typeof next === "string" ? next : null)}
    />
  );
}
