import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AuthCard } from "@/components/auth-card";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/app/dashboard");

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your account to continue"
      termsAction="logging in"
      alternate={{
        prompt: "Don't have an account?",
        label: "Sign up",
        href: "/signup",
      }}
    />
  );
}
