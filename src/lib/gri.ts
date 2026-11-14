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

const LABEL = /^\s*(requirement|disclosure|criterion|topic)\s*/;
const compact = (s: string) => s.toLowerCase().replace(LABEL, "").replace(/\s+/g, "");

/** Questions matching the search. A search with a digit is tried as a question number first ("requirement 1 a",
 * "305-1", "Strategy a) 1", "Core 1.5"): it finds the questions whose number starts with it, so 1 finds 1 a and
 * 1 b but not 10 a. If no number matches, or the search is words, every word must be in the number, title,
 * text or hint. */
export function filterQuestions<T extends { ref: string; item: string; title: string; text: string; hint?: string | null }>(questions: T[], search: string): T[] {
  const num = compact(search);
  if (/\d/.test(num)) {
    const byNumber = questions.filter((q) => {
      const n = compact(questionNumber(q.ref, q.item));
      return n.startsWith(num) && !/\d/.test(n.charAt(num.length));
    });
    if (byNumber.length > 0) return byNumber;
  }
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return questions;
  return questions.filter((q) => {
    const hay = `${questionNumber(q.ref, q.item)} ${disclosureLabel(q.ref)} ${q.title} ${q.text} ${q.hint ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
