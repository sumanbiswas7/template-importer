import * as XLSX from "xlsx";
import type { Section } from "./template";

// The columns we model, named exactly as in the spreadsheets we import (hints included).
// Every other imported column travels in `comment.extra` and is written back after these.
const HEADERS = {
  section: "Section Name",
  item: "Item Name",
  name: "Comment Name",
  text: "Comment Text",
  type: "Comment Type (info, limit, defect)",
  category: "Category (-1: Low, 0: Med, 1: High)",
  options: "Multiple Choice Options (comma-separated)",
  order: "Order (w/i item)",
  answerType: "Answer Type (boolean, checkbox, date, number, range, text)",
} as const;

/** Builds the spreadsheet rows; hidden sections, subsections and comments are left out. */
function toRows(tree: Section[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const s of tree.filter((s) => !s.hidden)) {
    for (const sub of s.subsections.filter((x) => !x.hidden)) {
      const base = { [HEADERS.section]: s.name, [HEADERS.item]: sub.name };
      const comments = sub.comments.filter((c) => !c.hidden);
      // A subsection with no comments still gets a row so it survives a re-import.
      if (comments.length === 0) rows.push(base);
      comments.forEach((c, i) => rows.push({
        ...base,
        [HEADERS.name]: c.name,
        [HEADERS.text]: c.text,
        [HEADERS.type]: c.type,
        [HEADERS.category]: c.category,
        [HEADERS.options]: c.options,
        [HEADERS.order]: String(i),
        [HEADERS.answerType]: c.answerType,
        ...c.extra,
      }));
    }
  }
  return rows;
}

/**
 * Downloads the template as `<name>.xls`. Like the exports we import, the file is
 * xlsx content under an .xls name, and it re-imports through the same parser.
 */
export function downloadXls(name: string, tree: Section[]) {
  const header = Object.values(HEADERS) as string[];
  const rows = toRows(tree);
  for (const r of rows) for (const k of Object.keys(r)) if (!header.includes(k)) header.push(k);
  const sheet = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  const file = `${name.trim() || "template"}.xls`;
  XLSX.writeFile(wb, file, { bookType: "xlsx" });
}
