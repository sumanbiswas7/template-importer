import { jsPDF } from "jspdf";
import { CATEGORY_LABELS, COMMENT_TYPES, type CommentType, type Section } from "./template";

const COLORS: Record<CommentType, [number, number, number]> = {
  defect: [0xd5, 0x87, 0x60],
  info: [0x52, 0x88, 0xc6],
  limit: [0xdf, 0xd3, 0x65],
};
const BLOCKS = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "UL", "OL"]);

/** Comment text is stored as HTML; flattens it to paragraphs of plain text (lists become "•" / "1." lines). */
function paragraphs(html: string): string[] {
  if (!html.trim()) return [];
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    const t = cur.replace(/[ \t ]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
    if (t) out.push(t);
    cur = "";
  };
  const walk = (node: Node, prefix = "") => {
    if (node.nodeType === Node.TEXT_NODE) { cur += node.textContent ?? ""; return; }
    if (!(node instanceof Element)) return;
    const tag = node.tagName;
    if (["SCRIPT", "STYLE"].includes(tag)) return;
    if (tag === "BR") { cur += "\n"; return; }
    if (tag === "UL" || tag === "OL") {
      flush();
      let n = 0;
      for (const li of node.children) {
        n++;
        flush();
        cur += tag === "OL" ? `${n}. ` : "• ";
        walk(li);
        flush();
      }
      return;
    }
    const block = BLOCKS.has(tag);
    if (block) flush();
    node.childNodes.forEach((c) => walk(c, prefix));
    if (block) flush();
  };
  new DOMParser().parseFromString(html, "text/html").body.childNodes.forEach((n) => walk(n));
  flush();
  return out;
}

/** Builds the template as a text-based PDF and downloads it straight away. Hidden items are left out. */
export function downloadPdf(name: string, tree: Section[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const width = W - M * 2;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) { doc.addPage(); y = M; }
  };
  /** Draws wrapped lines at x; returns their height. */
  const lines = (text: string, size: number, opts: { x?: number; w?: number; bold?: boolean; color?: number; gap?: number } = {}) => {
    const { x = M, w = width, bold = false, color = 0, gap = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).setTextColor(color);
    const wrapped: string[] = doc.splitTextToSize(text, w);
    const lh = size * 1.35;
    for (const l of wrapped) { ensure(lh); y += lh; doc.text(l, x, y - lh * 0.25); }
    y += gap;
  };
  const heading = (text: string, size: number, before: number, rule = false) => {
    ensure(size * 1.35 + before + 40); // keep a heading with the content that follows
    y += before;
    lines(text, size, { bold: true, gap: rule ? 2 : 4 });
    if (rule) { doc.setDrawColor(153).setLineWidth(0.5).line(M, y, W - M, y); y += 8; }
  };

  const typeLabel = Object.fromEntries(COMMENT_TYPES.map((t) => [t.type, t.label]));
  lines(name, 22, { bold: true, gap: 8 });

  for (const s of tree.filter((s) => !s.hidden)) {
    heading(s.name, 16, 14, true);
    for (const sub of s.subsections.filter((x) => !x.hidden)) {
      heading(sub.name, 13, 8);
      for (const c of sub.comments.filter((c) => !c.hidden)) {
        const meta = typeLabel[c.type].toUpperCase() + (c.category ? ` · ${CATEGORY_LABELS[c.category].toUpperCase()}` : "");
        const body = paragraphs(c.text);
        const start = { page: doc.getCurrentPageInfo().pageNumber, y };
        const x = M + 12, w = width - 12;
        lines(meta, 8.5, { x, w, color: 100, gap: 2 });
        if (c.name) lines(c.name, 11, { x, w, bold: true, gap: 2 });
        for (const p of body) lines(p, 11, { x, w, gap: 4 });
        if (c.options) lines(`Options: ${c.options}`, 8.5, { x, w, color: 100, gap: 2 });
        // Colour bar down the left, across a page break if the comment spilled over.
        const [r, g, b] = COLORS[c.type];
        const end = { page: doc.getCurrentPageInfo().pageNumber, y };
        for (let p = start.page; p <= end.page; p++) {
          doc.setPage(p);
          doc.setFillColor(r, g, b);
          const top = p === start.page ? start.y : M;
          const bottom = p === end.page ? end.y : H - M;
          doc.rect(M, top, 3, Math.max(bottom - top - 2, 1), "F");
        }
        doc.setPage(end.page);
        y += 6;
      }
    }
  }
  doc.save(`${name.trim() || "template"}.pdf`);
}
