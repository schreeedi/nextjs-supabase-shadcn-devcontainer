import { Skeleton } from "@/components/ui/skeleton";

// Same outer layout and card heights as page.tsx, so nothing jumps (CLS)
// when the auth round trip and profile read finish.
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-[22rem] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </main>
  );
}
