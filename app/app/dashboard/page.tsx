import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getInitials, getProviderLabel } from "@/lib/user";
import { loadPlan } from "@/lib/plan-gate";
import { PLAN_LABELS } from "@/lib/plan-features";
import { PlanGate } from "@/components/plan-gate";
import { LogOut, User, Mail, Shield } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const plan = await loadPlan(supabase, user.id);

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const fullName = user.user_metadata?.full_name as string | undefined;
  const email = user.email ?? "";
  const provider = user.app_metadata?.provider ?? "unknown";

  const initials = getInitials(fullName, email);
  const providerLabel = getProviderLabel(provider);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

          <div className="flex items-center gap-1">
            <ModeToggle />
            <form action="/auth/logout" method="POST">
              <Button variant="ghost" size="sm" type="submit" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Profile card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Your profile</h2>
            </CardTitle>
            <CardDescription>Signed in via {providerLabel}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt={fullName ?? email} />
                )}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                {fullName && <p className="text-lg font-medium">{fullName}</p>}
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </div>

            <Separator />

            {/* Detail rows */}
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <dt className="w-24 shrink-0 text-sm text-muted-foreground">
                  User ID
                </dt>
                <dd className="truncate font-mono text-xs">{user.id}</dd>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <dt className="w-24 shrink-0 text-sm text-muted-foreground">
                  Email
                </dt>
                <dd className="text-sm">{email}</dd>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <dt className="w-24 shrink-0 text-sm text-muted-foreground">
                  Provider
                </dt>
                <dd className="text-sm">{providerLabel}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Placeholder content card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Getting started</h2>
            </CardTitle>
            <CardDescription>
              Authentication is working. Build your app from here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span aria-hidden="true">✅</span> Supabase SSR client configured
            </p>
            <p>
              <span aria-hidden="true">✅</span> Google OAuth connected
            </p>
            <p>
              <span aria-hidden="true">✅</span> Facebook OAuth connected
            </p>
            <p>
              <span aria-hidden="true">✅</span> Protected routes via middleware
            </p>
            <p>
              <span aria-hidden="true">✅</span> Shadcn UI components ready
            </p>
            <p>
              Your plan: <strong>{PLAN_LABELS[plan]}</strong>
            </p>
            {/* Example of a plan-gated section (lib/plan-features.ts) */}
            <PlanGate plan={plan} feature="dataExport">
              <p>
                <span aria-hidden="true">✅</span> Data export available
              </p>
            </PlanGate>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
