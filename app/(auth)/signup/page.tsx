import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AuthCard } from "@/components/auth-card";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/app/dashboard");

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
    />
  );
}
