import { cn } from "@/lib/utils";

const TONES = [
  "bg-brand-soft text-brand-strong",
  "bg-moss-soft text-moss",
  "bg-amber-soft text-amber",
  "bg-slate-soft text-slate",
  "bg-rust-soft text-rust",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Initials in a soft colour that is stable for a given name. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", tone, className)}
    >
      {initials(name)}
    </span>
  );
}
