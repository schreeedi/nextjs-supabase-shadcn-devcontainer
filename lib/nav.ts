// Redirect helpers — framework-free so they are unit-testable.

/**
 * Only allow same-site absolute paths as a post-login redirect target, so a
 * crafted `?next=https://evil.example` can't turn the login flow into an open
 * redirect. Returns the path, or null if it isn't a safe internal one.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  // Reject control characters (the WHATWG parser silently strips tab/CR/LF:
  // "/\t/evil.example" → "//evil.example") and backslashes (treated as "/").
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (value.startsWith("//")) return null;
  // Last line of defence: once resolved, the origin must stay the same.
  const base = "http://x.invalid";
  try {
    if (new URL(value, base).origin !== base) return null;
  } catch {
    return null;
  }
  return value;
}

/**
 * 302 to a path on this site, with a **relative** `Location` header. The
 * browser resolves it against the URL it requested, so the server never needs
 * to know its public origin. Behind a reverse proxy `request.url` carries the
 * container's bind address, and `x-forwarded-host` can be spoofed by clients.
 *
 * Cookies set via `next/headers` (session on callback, cleared on logout) are
 * attached to the response by Next regardless of how it was created.
 */
export function redirectToPath(path: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: path } });
}
