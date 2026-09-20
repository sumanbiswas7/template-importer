"use client";

import { CATEGORY_LABELS, COMMENT_TYPES, type Section } from "@/lib/template";

const ALLOWED = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "PRE"]);
const DROPPED = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"]);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Comment text is HTML that may come straight from a spreadsheet, so rebuild it from a small allowlist (no attributes). */
function clean(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (!(node instanceof Element) || DROPPED.has(node.tagName)) return "";
    const inner = [...node.childNodes].map(walk).join("");
    if (node.tagName === "BR") return "<br>";
    const tag = node.tagName.toLowerCase();
    return ALLOWED.has(node.tagName) ? `<${tag}>${inner}</${tag}>` : inner;
  };
  return [...new DOMParser().parseFromString(html, "text/html").body.childNodes].map(walk).join("");
}

// A plain, print-only rendering of the whole template. Hidden on screen; "Export PDF" prints it.
export default function PrintView({ name, tree }: { name: string; tree: Section[] }) {
  const typeLabel = Object.fromEntries(COMMENT_TYPES.map((t) => [t.type, t.label]));
  return (
    <article className="print-doc" aria-hidden>
      <h1>{name}</h1>
      {tree.map((section) => (
        <section key={section.id}>
          <h2>{section.name}</h2>
          {section.subsections.map((sub) => (
            <div key={sub.id} className="print-doc__sub">
              <h3>{sub.name}</h3>
              {sub.comments.map((c) => (
                <div key={c.id} className={`print-doc__comment print-doc__comment--${c.type}`}>
                  <p className="print-doc__meta">
                    {typeLabel[c.type]}
                    {c.category && ` · ${CATEGORY_LABELS[c.category]}`}
                  </p>
                  {c.name && <p className="print-doc__name">{c.name}</p>}
                  <div dangerouslySetInnerHTML={{ __html: clean(c.text) }} />
                  {c.options && <p className="print-doc__meta">Options: {c.options}</p>}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
