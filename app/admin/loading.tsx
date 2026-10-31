import { Skeleton } from "@/components/ui/skeleton";

// Rendered inside the admin layout's <main>; mirrors the page's heading and
// card stack.
export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
