import { daysSince, pluralDays } from "@/lib/format";
import type { WaitingOn as Holder } from "@/types/survey";

const ROLE_LABEL = { responder: "to respond", reviewer: "to review", approver: "to approve" } as const;

/** Who a survey is with right now, and for how long -- the answer to "who is
 * holding this up?". With several respondents it names the first and counts the
 * rest. Shows a dash when it is with no one (draft, approved, closed). */
export function WaitingOn({ holder, since }: { holder: Holder[]; since: string }) {
  if (holder.length === 0) return <span className="text-ink-faint">—</span>;
  const [first, ...rest] = holder;
  const days = daysSince(since);
  return (
    <div>
      <div className="text-ink">
        {first.person.full_name}
        {rest.length > 0 && <span className="ml-1.5 rounded bg-paper-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-muted">+{rest.length} more</span>}
      </div>
      <div className="text-xs text-ink-faint">
        {first.count} question{first.count === 1 ? "" : "s"} {ROLE_LABEL[first.role]} · {days === 0 ? "since today" : pluralDays(days)}
      </div>
    </div>
  );
}
