import { daysSince, pluralDays } from "@/lib/format";
import type { WaitingOn as Holder } from "@/types/survey";

const ROLE_LABEL = { responder: "to respond", reviewer: "to review", approver: "to approve" } as const;

/** Who a survey is with right now, and for how long -- the answer to "who is
 * holding this up?". Shows a dash when it is with no one (draft, approved, closed). */
export function WaitingOn({ holder, since }: { holder: Holder | null; since: string }) {
  if (!holder) return <span className="text-ink-faint">—</span>;
  const days = daysSince(since);
  return (
    <div>
      <div className="text-ink">{holder.person.full_name}</div>
      <div className="text-xs text-ink-faint">
        {ROLE_LABEL[holder.role]} · {days === 0 ? "since today" : pluralDays(days)}
      </div>
    </div>
  );
}
