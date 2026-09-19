// In-memory store. Fine for a demo; resets on cold start.
// Swap for Vercel KV / Postgres when you need persistence.
export type Template = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

const templates: Template[] = [
  {
    id: "1",
    name: "Welcome email",
    content: "Hi {{name}}, welcome aboard!",
    createdAt: new Date().toISOString(),
  },
];

export const listTemplates = () => templates;

export function addTemplate(name: string, content: string): Template {
  const template = {
    id: crypto.randomUUID(),
    name,
    content,
    createdAt: new Date().toISOString(),
  };
  templates.unshift(template);
  return template;
}

export function removeTemplate(id: string): boolean {
  const i = templates.findIndex((t) => t.id === id);
  if (i === -1) return false;
  templates.splice(i, 1);
  return true;
}
