import { cn } from "@/lib/utils";

/** Three linked nodes: respondent, reviewer, approver. The last one is the
 * "you are here" amber, the colour the app uses for who a survey is waiting on. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} role="img" aria-label="OrgSurvey">
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path d="M8 21 L16 11 L24 21" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8" cy="21" r="3" fill="white" />
      <circle cx="16" cy="11" r="3" fill="white" />
      <circle cx="24" cy="21" r="3" className="fill-sidebar-mark" />
    </svg>
  );
}
