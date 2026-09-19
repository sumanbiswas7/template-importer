import * as XLSX from "xlsx";
import { uid, type Category, type Comment, type CommentType, type Section } from "./template";

// Column headers carry hints in parentheses, e.g. "Comment Type (info, limit, defect)",
// so columns are matched by prefix.
const COLS = {
  section: "Section Name",
  item: "Item Name",
  name: "Comment Name",
  text: "Comment Text",
  type: "Comment Type",
  category: "Category",
  options: "Multiple Choice Options",
  order: "Order",
  answerType: "Answer Type",
} as const;

const TYPES: CommentType[] = ["defect", "info", "limit"];
const CATEGORIES: Category[] = ["-1", "0", "1"];

export async function parseTemplateFile(file: File): Promise<Section[]> {
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } catch {
    throw new Error("Couldn't read that file. Use an .xls, .xlsx or .csv export.");
  }
  if (rows.length === 0) throw new Error("The spreadsheet has no rows.");

  const headers = Object.keys(rows[0]);
  const col = {} as Record<keyof typeof COLS, string | undefined>;
  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    col[k] = headers.find((h) => h.trim().startsWith(COLS[k]));
  }
  for (const k of ["section", "item", "name"] as const) {
    if (!col[k]) throw new Error(`Missing required column "${COLS[k]}".`);
  }
  const mapped = new Set(Object.values(col));
  const get = (r: Record<string, unknown>, k: keyof typeof COLS) =>
    col[k] ? String(r[col[k]!] ?? "").trim() : "";

  const sections = new Map<string, Map<string, { order: number; c: Comment }[]>>();
  rows.forEach((r, index) => {
    const sectionName = get(r, "section") || "Untitled section";
    const itemName = get(r, "item") || "Untitled subsection";
    const items = sections.get(sectionName) ?? new Map();
    sections.set(sectionName, items);
    const list = items.get(itemName) ?? [];
    items.set(itemName, list);

    const name = get(r, "name");
    const text = get(r, "text");
    if (!name && !text) return; // row only declares the subsection

    const type = get(r, "type").toLowerCase() as CommentType;
    const category = get(r, "category") as Category;
    const extra: Record<string, string> = {};
    for (const h of headers) if (!mapped.has(h)) extra[h] = String(r[h] ?? "");
    const order = parseInt(get(r, "order"), 10);

    list.push({
      order: Number.isNaN(order) ? index : order,
      c: {
        id: uid(), name, text,
        type: TYPES.includes(type) ? type : "info",
        category: CATEGORIES.includes(category) ? category : "",
        options: get(r, "options"),
        answerType: get(r, "answerType") || "boolean",
        extra,
      },
    });
  });

  return [...sections].map(([name, items]) => ({
    id: uid(),
    name,
    subsections: [...items].map(([itemName, list]) => ({
      id: uid(),
      name: itemName,
      comments: list.sort((a, b) => a.order - b.order).map((x) => x.c),
    })),
  }));
}
