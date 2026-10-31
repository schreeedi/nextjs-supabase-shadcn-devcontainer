"use client"; // Error boundaries must be Client Components

import "./globals.css";

// Replaces the root layout when it fails itself, so it brings its own
// <html>/<body> and styles. No metadata export here — <title> instead.
// No ThemeProvider either: keep this page free of anything that could fail.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          {error.digest && (
            <p className="text-sm text-muted-foreground">
              Code: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <button
            onClick={() => retry()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
