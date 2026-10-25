import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("tabular w-full border-collapse text-sm", className)} {...p} />
    </div>
  );
}
export function Th({ className, numeric, ...p }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cn("border-b border-border bg-surface-2/60 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap", numeric && "text-right", className)} {...p} />;
}
export function Td({ className, numeric, ...p }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("border-b border-border/70 px-3 py-2 whitespace-nowrap", numeric && "text-right", className)} {...p} />;
}
