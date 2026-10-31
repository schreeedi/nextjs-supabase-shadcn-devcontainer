import type { Instrumentation } from "next";

// One central place for every uncaught server error — render, route handler,
// server action, proxy — as a structured log line with the request id (set in
// proxy.ts). Swap in Sentry/OpenTelemetry here if you add one; the call
// sites stay unchanged.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { createLogger } = await import("@/lib/logger");
  const requestId = request.headers["x-request-id"];
  createLogger({ service: "app" }).error("request error", {
    err: error,
    method: request.method,
    path: request.path,
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    routeType: context.routeType,
    routePath: context.routePath,
    renderSource: context.renderSource,
  });
};
