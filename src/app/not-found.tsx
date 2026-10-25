import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">The case or page you are looking for does not exist.</p>
      <Button asChild className="mt-4"><Link href="/cases">Browse the case library</Link></Button>
    </div>
  );
}
