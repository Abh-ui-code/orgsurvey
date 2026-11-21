import { DEFAULT_ROW_HEADER, DEFAULT_VALUE_HEADER, type QuestionPart } from "@/types/question";

/** A table question drawn as a small table (row labels beside empty answer cells), so it reads as a table at a glance. */
export function TablePreview({ parts, rowHeader, valueHeader }: { parts: QuestionPart[] | undefined; rowHeader?: string; valueHeader?: string }) {
  if (!parts?.length) return null;
  return (
    <div className="mt-2 max-w-2xl overflow-hidden rounded-md border border-line bg-paper-raised">
      <table className="w-full text-left text-xs">
        <thead className="bg-paper-sunken text-2xs font-semibold uppercase tracking-wider text-ink-faint">
          <tr>
            <th scope="col" className="w-3/5 border-r border-line px-3 py-1.5">{rowHeader || DEFAULT_ROW_HEADER}</th>
            <th scope="col" className="px-3 py-1.5">{valueHeader || DEFAULT_VALUE_HEADER}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {parts.map((p, i) => (
            <tr key={i}>
              <td className="border-r border-line px-3 py-1.5 text-ink">{p.label}</td>
              <td className="px-3 py-1.5 text-ink-faint">
                {p.kind === "number" ? (p.unit ? `Number (${p.unit})` : "Number") : p.kind === "date" ? "Date" : p.kind === "yes_no" ? "Yes / No" : "Text"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
