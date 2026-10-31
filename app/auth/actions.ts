"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isOAuthProvider } from "@/lib/user";
import { safeNextPath } from "@/lib/nav";
import { authCallbackUrl } from "@/lib/site";

export async function signInWithProvider(formData: FormData) {
  // Form input is untrusted — only start flows for providers we actually offer.
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) redirect("/error");

  // Carry the original target (set by the proxy as ?next=) through the OAuth
  // round trip; the callback validates it again.
  const next = safeNextPath(formData.get("next")?.toString());

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallbackUrl(next) },
  });

  if (error) {
    redirect("/error");
  }

  redirect(data.url);
}
