/** Escape one CSV cell: quote it if it holds a comma, quote or newline. */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Download rows as a CSV file. A byte-order mark is prepended so Excel
 * reads accents and symbols as UTF-8 rather than guessing. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const body = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A safe file name from a title: "Q4 Pulse / Eng" -> "q4-pulse-eng". */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}
