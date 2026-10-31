import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-session";
import { createServiceClient } from "@/utils/supabase/service";
import { normalizePlan, PLAN_LABELS } from "@/lib/plan-features";
import { queueProblems } from "@/scripts/worker/monitor.mjs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdminPage();
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const svc = createServiceClient();

  const [usersRes, queuesRes, auditRes] = await Promise.all([
    svc.auth.admin.listUsers({ page, perPage: PAGE_SIZE }),
    svc.rpc("queue_health"),
    svc
      .from("admin_audit")
      .select("id, admin_id, target_user_id, action, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const users = usersRes.data?.users ?? [];
  const { data: profiles } = users.length
    ? await svc
        .from("profiles")
        .select("id, plan")
        .in(
          "id",
          users.map((u) => u.id),
        )
    : { data: [] };
  const planOf = new Map(
    (profiles ?? []).map((p) => [p.id, normalizePlan(p.plan)]),
  );
  const queues = queuesRes.data ?? [];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base">Queues</h2>
          </CardTitle>
          <CardDescription>
            Backlog and dead jobs of the last 24 h (worker queues).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queuesRes.error ? (
            <p className="text-sm text-destructive">
              queue_health failed: {queuesRes.error.message}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Queue</th>
                  <th className="py-2 font-medium">Waiting</th>
                  <th className="py-2 font-medium">Oldest (s)</th>
                  <th className="py-2 font-medium">Dead (24 h)</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => {
                  const problems = queueProblems(q);
                  return (
                    <tr key={q.queue_name} className="border-b last:border-0">
                      <td className="py-2 font-mono">{q.queue_name}</td>
                      <td className="py-2">{q.queue_length}</td>
                      <td className="py-2">{q.oldest_msg_age_sec ?? "–"}</td>
                      <td className="py-2">{q.dead_recent}</td>
                      <td
                        className={
                          problems.length
                            ? "py-2 text-destructive"
                            : "py-2 text-muted-foreground"
                        }
                      >
                        {problems.length ? problems.join("; ") : "ok"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base">Users</h2>
          </CardTitle>
          <CardDescription>Page {page}</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">E-mail</th>
                <th className="py-2 font-medium">Plan</th>
                <th className="py-2 font-medium">Provider</th>
                <th className="py-2 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b last:border-0 hover:bg-accent/40"
                >
                  <td className="py-2">
                    <Link
                      href={`/admin/users/${u.id}`}
                      prefetch={false}
                      className="underline-offset-4 hover:underline"
                    >
                      {u.email ?? u.id}
                    </Link>
                  </td>
                  <td className="py-2">
                    {PLAN_LABELS[planOf.get(u.id) ?? "free"]}
                  </td>
                  <td className="py-2">{u.app_metadata?.provider ?? "–"}</td>
                  <td className="py-2">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString()
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-4 text-sm">
            {page > 1 && (
              <Link
                href={`/admin?page=${page - 1}`}
                prefetch={false}
                className="underline-offset-4 hover:underline"
              >
                ← Previous
              </Link>
            )}
            {users.length === PAGE_SIZE && (
              <Link
                href={`/admin?page=${page + 1}`}
                prefetch={false}
                className="underline-offset-4 hover:underline"
              >
                Next →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base">Recent admin actions</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(auditRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {auditRes.data!.map((a) => (
                <li key={a.id} className="font-mono text-xs">
                  {new Date(a.created_at).toLocaleString()} · {a.action} ·{" "}
                  {a.target_user_id ?? "–"} · {JSON.stringify(a.detail)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
