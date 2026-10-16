import { LogoMark } from "@/components/shared/logo";

/** The product mark shown above the sign-in forms. */
export function Brand() {
  return (
    <div className="mb-8 flex items-center gap-2.5">
      <LogoMark className="h-9 w-9" />
      <span className="font-display text-xl font-semibold text-ink">OrgSurvey</span>
    </div>
  );
}
