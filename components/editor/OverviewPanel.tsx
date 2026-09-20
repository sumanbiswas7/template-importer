"use client";

import { IconChevronRight, IconFolders, IconListTree, IconSearch, IconX } from "@tabler/icons-react";
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
  const [query, setQuery] = useState("");
  const totals = countComments(tree);
  const totalComments = totals.counts.defect + totals.counts.info + totals.counts.limit;

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

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return rows;
    const match = (r: Row) => [r.name, r.text, r.sectionName, r.subsectionName].some((v) => v.toLowerCase().includes(q));
    return {
      defect: rows.defect.filter(match), info: rows.info.filter(match), limit: rows.limit.filter(match),
    } satisfies Record<CommentType, Row[]>;
  }, [rows, q]);
  const matches = visible.defect.length + visible.info.length + visible.limit.length;

  return (
    <>
      <div className="overview__top">
        <h1>Overview</h1>
        <label className="osearch">
          <IconSearch size={16} className="osearch__icon" />
          <input
            type="search" value={query} placeholder="Search comments…" aria-label="Search comments"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="osearch__clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <IconX size={14} />
            </button>
          )}
        </label>
      </div>
      <p className="crumb">Pick a subsection in the tree, or jump straight to a comment below.</p>
      <div className="stats">
        <div className="stat stat--plain">
          <IconFolders size={20} className="stat__icon" />
          <strong>{totals.sections}</strong><span>Sections</span>
        </div>
        <div className="stat stat--plain">
          <IconListTree size={20} className="stat__icon" />
          <strong>{totals.subsections}</strong><span>Subsections</span>
        </div>
        {COMMENT_TYPES.map(({ type, label }) => {
          const Icon = TYPE_ICON[type];
          return (
            <div key={type} className={`stat stat--${type}`}>
              <Icon size={20} className="stat__icon" />
              <strong>{totals.counts[type]}</strong><span>{label}</span>
            </div>
          );
        })}
      </div>

      {totalComments > 0 && (
        <div className="mix" role="img" aria-label="Comment breakdown by type">
          {COMMENT_TYPES.map(({ type, label }) => totals.counts[type] > 0 && (
            <span key={type} className={`mix__seg mix__seg--${type}`} style={{ flexGrow: totals.counts[type] }}
              title={`${label}: ${totals.counts[type]} (${Math.round((totals.counts[type] / totalComments) * 100)}%)`} />
          ))}
        </div>
      )}

      {q && matches === 0 && <p className="muted overview__empty">No comments match “{query.trim()}”.</p>}

      {COMMENT_TYPES.map(({ type, label, hint }) => {
        const list = visible[type];
        if (list.length === 0) return null;
        const Icon = TYPE_ICON[type];
        const remaining = list.length - shown[type];
        return (
          <section key={type} className={`group group--${type}`}>
            <header className="group__head">
              <span className="group__titles">
                <span className="group__title">{label}</span>
                <span className="group__hint">{hint}</span>
              </span>
              <span className="pill group__count">{list.length}</span>
            </header>
            <ul className="jump">
              {list.slice(0, shown[type]).map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpen(r.sectionId, r.subsectionId, r.id)}>
                    <span className="jump__badge"><Icon size={16} /></span>
                    <span className="jump__main">
                      <strong>{r.name || <em>Untitled comment</em>}</strong>
                      {r.text && <span>{r.text}</span>}
                    </span>
                    <span className="jump__where">
                      {r.sectionName} <IconChevronRight size={12} /> {r.subsectionName}
                    </span>
                    <IconChevronRight size={16} className="jump__go" />
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
