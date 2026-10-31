import { AuthCard } from "@/components/auth-card";
import { safeNextPath } from "@/lib/nav";

// Signed-in users never get here: the proxy redirects them away
// (utils/supabase/middleware.ts).
export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { next } = await searchParams;

  return (
    <AuthCard
      title="Create your account"
      description="Get started for free in seconds"
      termsAction="signing up"
      alternate={{
        prompt: "Already have an account?",
        label: "Log in",
        href: "/login",
      }}
      next={safeNextPath(typeof next === "string" ? next : null)}
    />
  );
}
