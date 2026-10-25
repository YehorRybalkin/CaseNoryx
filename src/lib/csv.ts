import type { ColumnDef, Row } from "./cases/types";

/** RFC 4180 CSV with protection against spreadsheet formula injection. */
export function toCsv(columns: ColumnDef[], rows: Row[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label + (c.unit ? ` (${c.unit})` : c.type === "percent" ? " (fraction)" : ""))).join(",");
  return [header, ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\r\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
