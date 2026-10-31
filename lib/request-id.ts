// Correlation id per request (proxy.ts → x-request-id → every log line).
// Framework-free so it is unit-testable.

// Typical ids from nginx ($request_id), load balancers and UUIDs. Anything
// else is client input we don't want in the logs verbatim.
const VALID = /^[\w.:-]{1,64}$/;

/** The incoming x-request-id if well-formed, otherwise a fresh UUID. */
export function requestId(header: string | null): string {
  return header && VALID.test(header) ? header : crypto.randomUUID();
}
