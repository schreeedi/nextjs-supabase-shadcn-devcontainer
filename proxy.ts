import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { NOINDEX_HEADER, siteIndexable } from "@/lib/site";
import { requestId as toRequestId } from "@/lib/request-id";

export async function proxy(request: NextRequest) {
  // Correlation id for every log line of this request (instrumentation.ts);
  // a well-formed one sent by the reverse proxy is kept. updateSession
  // forwards request.headers via NextResponse.next({ request }), which is how
  // the id reaches route handlers and server components.
  const requestId = toRequestId(request.headers.get("x-request-id"));
  request.headers.set("x-request-id", requestId);

  const response = await updateSession(request);
  response.headers.set("x-request-id", requestId);
  // Staging/preview: header instead of <meta robots>, so statically built
  // pages need no per-environment build.
  if (!siteIndexable()) response.headers.set("X-Robots-Tag", NOINDEX_HEADER);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/        static files, image optimisation AND the HMR websocket
     *                 (_next/webpack-hmr). If the upgrade request runs through
     *                 updateSession, the websocket handshake fails and the
     *                 page never hydrates in dev.
     * - api/          route handlers that authenticate themselves and must
     *                 answer with JSON, never with a redirect to /login
     * - favicon.ico and public image assets
     */
    "/((?!_next/|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    // The pattern above skips any path ending in an image extension — also
    // /app/foo.png, which would still hit an /app page. Always guard /app
    // and /admin.
    "/app/:path*",
    "/admin/:path*",
  ],
};
