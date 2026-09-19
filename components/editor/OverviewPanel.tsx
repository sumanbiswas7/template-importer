"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { TYPE_ICON } from "./CommentCard";
import { COMMENT_TYPES, countComments, plainText, type CommentType, type Section } from "@/lib/template";

const PAGE = 10;

type Row = { id: string; name: string; text: string; sectionId: string; sectionName: string; subsectionId: string; subsectionName: string };

export default function OverviewPanel({
  tree, onOpen,
}: {
  tree: Section[];
  onOpen: (sectionId: string, subsectionId: string, commentId: string) => void;
}) {
  const [shown, setShown] = useState<Record<CommentType, number>>({ defect: PAGE, info: PAGE, limit: PAGE });
  const totals = countComments(tree);

  const rows = useMemo(() => {
    const byType: Record<CommentType, Row[]> = { defect: [], info: [], limit: [] };
    for (const s of tree) for (const sub of s.subsections) for (const c of sub.comments) {
      byType[c.type].push({
        id: c.id, name: c.name, text: plainText(c.text),
        sectionId: s.id, sectionName: s.name, subsectionId: sub.id, subsectionName: sub.name,
      });
    }
    return byType;
  }, [tree]);

  return (
    <>
      <h1>Overview</h1>
      <p className="crumb">Pick a subsection in the tree, or jump straight to a comment below.</p>
      <div className="stats">
        {[
          ["Sections", totals.sections],
          ["Subsections", totals.subsections],
          ["Defects", totals.counts.defect],
          ["Information", totals.counts.info],
          ["Limitations", totals.counts.limit],
        ].map(([label, n]) => (
          <div key={label} className="stat"><strong>{n}</strong><span>{label}</span></div>
        ))}
      </div>

      {COMMENT_TYPES.map(({ type, label }) => {
        const list = rows[type];
        if (list.length === 0) return null;
        const Icon = TYPE_ICON[type];
        const remaining = list.length - shown[type];
        return (
          <section key={type} className={`group group--${type}`}>
            <header className="group__head">
              <span className="pill pill--group">{label}</span>
              <span className="pill">{list.length}</span>
            </header>
            <ul className="jump">
              {list.slice(0, shown[type]).map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpen(r.sectionId, r.subsectionId, r.id)}>
                    <Icon size={18} className="jump__icon" />
                    <span className="jump__main">
                      <strong>{r.name || <em>Untitled comment</em>}</strong>
                      {r.text && <span>{r.text}</span>}
                    </span>
                    <span className="jump__where">
                      {r.sectionName} <IconChevronRight size={12} /> {r.subsectionName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <button className="btn jump__more" onClick={() => setShown((s) => ({ ...s, [type]: s[type] + PAGE }))}>
                Load {Math.min(PAGE, remaining)} more <span className="muted">({remaining} left)</span>
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}
