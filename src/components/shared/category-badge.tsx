import { Badge } from "@/components/ui/badge";
import type { CategoryColor } from "@/types/survey";

/** `slate` is the neutral tone; the other colours map one to one. */
const TONE: Record<CategoryColor, "brand" | "amber" | "moss" | "rust" | "neutral"> = {
  brand: "brand",
  amber: "amber",
  moss: "moss",
  rust: "rust",
  slate: "neutral",
};

export function CategoryBadge({ label, color }: { label: string; color: CategoryColor }) {
  return <Badge tone={TONE[color] ?? "neutral"}>{label}</Badge>;
}
