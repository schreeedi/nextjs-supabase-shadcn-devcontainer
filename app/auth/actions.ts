"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isOAuthProvider } from "@/lib/user";
import { safeNextPath } from "@/lib/nav";

export async function signInWithProvider(formData: FormData) {
  // Form input is untrusted — only start flows for providers we actually offer.
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) redirect("/error");

  // Carry the original target (set by the proxy as ?next=) through the OAuth
  // round trip; the callback validates it again.
  const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL);
  const next = safeNextPath(formData.get("next")?.toString());
  if (next) callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error) {
    redirect("/error");
  }

  redirect(data.url);
}
