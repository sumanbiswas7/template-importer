import { summarize, type Section } from "./template";

// In-memory store. Fine for a demo; resets on cold start.
// Swap for Vercel KV / Postgres when you need persistence.
export type Template = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

// The full document, including the section → subsection → comment tree.
export type TemplateDoc = Template & { tree: Section[] };

const docs: TemplateDoc[] = [
  {
    id: "1",
    name: "Welcome email",
    content: "Hi {{name}}, welcome aboard!",
    createdAt: new Date().toISOString(),
    tree: [],
  },
];

// The list view never needs the (large) tree.
const summary = ({ tree: _tree, ...t }: TemplateDoc): Template => t;

export const listTemplates = () => docs.map(summary);

export const getTemplate = (id: string) => docs.find((t) => t.id === id) ?? null;

// "Report" → "Report 2" → "Report 3" when the name is already taken.
function uniqueName(name: string): string {
  const taken = new Set(docs.map((t) => t.name.toLowerCase()));
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} ${n}`;
  return candidate;
}

export function addTemplate(name: string, content: string, tree: Section[] = []): Template {
  const doc: TemplateDoc = {
    id: crypto.randomUUID(),
    name: uniqueName(name),
    content: tree.length ? summarize(tree) : content,
    createdAt: new Date().toISOString(),
    tree,
  };
  docs.unshift(doc);
  return summary(doc);
}

export function removeTemplate(id: string): boolean {
  const i = docs.findIndex((t) => t.id === id);
  if (i === -1) return false;
  docs.splice(i, 1);
  return true;
}

export function updateTemplate(
  id: string,
  patch: { name?: string; content?: string; tree?: Section[] },
): Template | null {
  const t = docs.find((t) => t.id === id);
  if (!t) return null;
  if (patch.name !== undefined) t.name = patch.name;
  if (patch.content !== undefined) t.content = patch.content;
  if (patch.tree) {
    t.tree = patch.tree;
    t.content = summarize(patch.tree);
  }
  return summary(t);
}
