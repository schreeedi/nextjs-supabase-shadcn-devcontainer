// Liveness: the process answers. No dependencies — a DB outage must not get
// the container restarted. For Docker HEALTHCHECK and uptime monitors.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
