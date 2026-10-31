import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isUuid } from "@/lib/admin";
import { requireAdminPage } from "@/lib/admin-session";
import { createLogger } from "@/lib/logger";
import { normalizePlan } from "@/lib/plan-features";
import { createServiceClient } from "@/utils/supabase/service";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  const adminId = await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const svc = createServiceClient();
  const [
    { data: userRes },
    { data: profile },
    { data: jobs },
    { data: audit },
  ] = await Promise.all([
    svc.auth.admin.getUserById(id),
    svc
      .from("profiles")
      .select("plan, full_name, created_at")
      .eq("id", id)
      .maybeSingle(),
    svc
      .from("jobs")
      .select("id, queue, type, status, attempts, last_error, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    svc
      .from("admin_audit")
      .select("id, action, detail, created_at")
      .eq("target_user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const user = userRes?.user;
  if (!user) notFound();

  // Reading another user's data is logged (not audited — admin_audit is for writes).
  createLogger({ service: "app", action: "admin:view" }).info(
    "admin viewed user",
    { adminId, targetUserId: id },
  );

  return (
    <>
      <Link
        href="/admin"
        prefetch={false}
        className="text-sm text-muted-foreground"
      >
        ← Users
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{user.email ?? user.id}</CardTitle>
          <CardDescription className="font-mono text-xs">
            {user.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{profile?.full_name ?? "–"}</dd>
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{user.app_metadata?.provider ?? "–"}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(user.created_at).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd>
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "–"}
            </dd>
          </dl>
          {profile ? (
            <PlanForm userId={id} plan={normalizePlan(profile.plan)} />
          ) : (
            <p className="text-destructive">No profile row for this user.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs</CardTitle>
          <CardDescription>
            Last 20 background jobs of this user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2 font-medium">Queue / type</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Attempts</th>
                  <th className="py-2 font-medium">Last error</th>
                </tr>
              </thead>
              <tbody>
                {jobs!.map((j) => (
                  <tr key={j.id} className="border-b last:border-0">
                    <td className="py-2">
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {j.queue} / {j.type}
                    </td>
                    <td className="py-2">{j.status}</td>
                    <td className="py-2">{j.attempts}</td>
                    <td className="max-w-xs truncate py-2 text-xs text-muted-foreground">
                      {j.last_error ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Admin actions on this user
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(audit ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {audit!.map((a) => (
                <li key={a.id}>
                  {new Date(a.created_at).toLocaleString()} · {a.action} ·{" "}
                  {JSON.stringify(a.detail)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
