"use client"; // Error boundaries must be Client Components

import { Button } from "@/components/ui/button";

// Uncaught render errors below the root layout. The server side is already
// logged with the request id (instrumentation.ts → onRequestError); the digest
// lets support find that log line.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        Please try again. If it keeps happening, contact support
        {error.digest ? (
          <>
            {" "}
            with the code <code className="font-mono">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      {/* retry() re-fetches and re-renders the segment (stable since 16.3). */}
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
