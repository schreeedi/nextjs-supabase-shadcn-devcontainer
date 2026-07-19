import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
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
import { LogOut, User, Mail, Shield } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const fullName = user.user_metadata?.full_name as string | undefined;
  const email = user.email ?? "";
  const provider = user.app_metadata?.provider ?? "unknown";

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  const providerLabel =
    provider === "google"
      ? "Google"
      : provider === "azure"
        ? "Microsoft"
        : provider;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

          <form action="/auth/logout" method="POST">
            <Button variant="ghost" size="sm" type="submit" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>

        {/* Profile card */}
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              Signed in via {providerLabel}
            </CardDescription>
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
                {fullName && (
                  <p className="text-lg font-medium">{fullName}</p>
                )}
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
            <CardTitle>Getting started</CardTitle>
            <CardDescription>
              Authentication is working. Build your app from here.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>✅ Supabase SSR client configured</p>
            <p>✅ Google OAuth connected</p>
            <p>✅ Microsoft (Azure) OAuth connected</p>
            <p>✅ Protected routes via middleware</p>
            <p>✅ Shadcn UI components ready</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
