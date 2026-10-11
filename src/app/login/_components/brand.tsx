/** The product mark shown above the sign-in forms. */
export function Brand() {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-base font-bold text-brand-contrast">O</span>
      <span className="text-lg font-semibold text-ink">OrgSurvey</span>
    </div>
  );
}
