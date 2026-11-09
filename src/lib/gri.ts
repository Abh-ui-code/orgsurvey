/** How a group is named in its PDF: "Disclosure 305-1", "Topic 11.1", "Requirement 2" or "Criterion 1.1" (RSPO). */
export function disclosureLabel(ref: string): string {
  if (/^\d+-\d+$/.test(ref)) return `Disclosure ${ref}`;
  return /^\d+\.\d+$/.test(ref) ? `Criterion ${ref}` : ref;
}

/** The number a question carries in the PDF: "305-1 a" (disclosure and requirement letter) or "SV-AD-220a.1" (SASB metric). */
export function questionNumber(ref: string, item: string): string {
  if (!item || item === ref) return ref;
  return item.startsWith(".") ? `${ref}${item}` : `${ref} ${item}`;
}

export interface DisclosureGroup<T> {
  ref: string;
  title: string;
  items: T[];
}

/** Consecutive questions of the same disclosure, in PDF order. Questions with no title (SASB) each stand alone. */
export function groupByDisclosure<T extends { ref: string; title: string }>(questions: T[]): DisclosureGroup<T>[] {
  const groups: DisclosureGroup<T>[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (q.title && last && last.ref === q.ref && last.title === q.title) last.items.push(q);
    else groups.push({ ref: q.ref, title: q.title, items: [q] });
  }
  return groups;
}
