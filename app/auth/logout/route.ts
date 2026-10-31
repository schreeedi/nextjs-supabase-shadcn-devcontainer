import { createClient } from "@/utils/supabase/server";
import { redirectToPath } from "@/lib/nav";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303: the browser follows a POST redirect with GET.
  return redirectToPath("/", 303);
}
