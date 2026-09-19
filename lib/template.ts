// Shared (client + server) template model and pure tree helpers.
// Terminology follows the editor UI: Section → Subsection (spreadsheet "Item") → Comment.

export type CommentType = "defect" | "info" | "limit";
export type Category = "" | "-1" | "0" | "1";

export type Comment = {
  id: string;
  name: string;
  text: string;
  type: CommentType;
  category: Category;
  options: string; // comma-separated multiple choice options
  answerType: string;
  // Every other spreadsheet column, kept so a future export can round-trip.
  extra: Record<string, string>;
};

export type Subsection = { id: string; name: string; comments: Comment[] };
export type Section = { id: string; name: string; subsections: Subsection[] };

export const COMMENT_TYPES: { type: CommentType; label: string }[] = [
  { type: "defect", label: "Defects / Deficiencies" },
  { type: "info", label: "Information" },
  { type: "limit", label: "Limitations" },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  "": "No category",
  "-1": "Low",
  "0": "Medium",
  "1": "High",
};

export const ANSWER_TYPES = ["boolean", "checkbox", "text", "number", "range", "date"];

export const uid = () => crypto.randomUUID();

export const newComment = (type: CommentType): Comment => ({
  id: uid(), name: "", text: "", type, category: "", options: "",
  answerType: type === "info" ? "checkbox" : "boolean", extra: {},
});

export const newSubsection = (name = "New subsection"): Subsection =>
  ({ id: uid(), name, comments: [] });

export const newSection = (name = "New section"): Section =>
  ({ id: uid(), name, subsections: [] });

export function countComments(tree: Section[]) {
  const counts: Record<CommentType, number> = { defect: 0, info: 0, limit: 0 };
  let subsections = 0;
  for (const s of tree) {
    subsections += s.subsections.length;
    for (const sub of s.subsections) for (const c of sub.comments) counts[c.type]++;
  }
  return { sections: tree.length, subsections, comments: counts.defect + counts.info + counts.limit, counts };
}

export function summarize(tree: Section[]) {
  const n = countComments(tree);
  return `${n.sections} sections · ${n.subsections} subsections · ${n.comments} comments`;
}

export function isSectionArray(v: unknown): v is Section[] {
  return Array.isArray(v) && v.every((s) => s && typeof s.id === "string" && Array.isArray(s.subsections));
}

// --- immutable updates -------------------------------------------------------

export const mapSection = (tree: Section[], id: string, fn: (s: Section) => Section) =>
  tree.map((s) => (s.id === id ? fn(s) : s));

export const mapSubsection = (
  tree: Section[], sectionId: string, id: string, fn: (s: Subsection) => Subsection,
) => mapSection(tree, sectionId, (s) => ({
  ...s, subsections: s.subsections.map((sub) => (sub.id === id ? fn(sub) : sub)),
}));

/** Rewrites a filtered group's slots in `all` with `next`, leaving other items in place. */
export function reorderGroup<T extends { id: string }>(all: T[], next: T[]): T[] {
  const ids = new Set(next.map((n) => n.id));
  let i = 0;
  return all.map((c) => (ids.has(c.id) ? next[i++] : c));
}
