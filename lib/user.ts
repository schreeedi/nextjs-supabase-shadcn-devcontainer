// Pure display helpers for user/auth data — kept framework-free so they are
// trivially unit-testable without a running Supabase or DOM.

export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
};

/** Narrows untrusted form input to a provider that is actually enabled. */
export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly unknown[]).includes(value);
}

/** Human-friendly label for an auth provider id (falls back to the raw id). */
export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Two-letter initials from a full name, falling back to the first two
 * characters of the email. Returns "" if neither is available.
 */
export function getInitials(
  fullName?: string | null,
  email?: string | null,
): string {
  if (fullName && fullName.trim()) {
    return fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "").slice(0, 2).toUpperCase();
}
