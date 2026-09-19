"use client";

import { IconArrowLeft, IconCheck, IconLoader2, IconAlertCircle } from "@tabler/icons-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EditableTitle from "./EditableTitle";
import SubsectionPanel from "./SubsectionPanel";
import TreeNav, { type Selection } from "./TreeNav";
import { countComments, mapSection, mapSubsection, type Section } from "@/lib/template";
import "@/styles/editor.scss";

type Status = "saved" | "saving" | "error";
const SAVE_DELAY = 700;

export default function Editor({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [tree, setTree] = useState<Section[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [status, setStatus] = useState<Status>("saved");

  // Latest unsaved edit, flushed on a debounce and when leaving the page.
  const pending = useRef<{ name: string; tree: Section[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch(`/api/templates?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) return setMissing(true);
        const doc = await res.json();
        nameRef.current = doc.name;
        treeRef.current = doc.tree ?? [];
        setName(doc.name);
        setTree(treeRef.current);
      })
      .catch(() => setMissing(true));
  }, [id]);

  // Refs mirror state so back-to-back edits in one tick merge into the latest values.
  const nameRef = useRef("");
  const treeRef = useRef<Section[]>([]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!body) return;
    pending.current = null;
    setStatus("saving");
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setStatus(pending.current ? "saving" : "saved");
    } catch {
      pending.current ??= body; // retry with the next edit
      setStatus("error");
    }
  }, [id]);

  const edit = useCallback((next: { name?: string; tree?: Section[] }) => {
    if (next.name !== undefined) { nameRef.current = next.name; setName(next.name); }
    if (next.tree) { treeRef.current = next.tree; setTree(next.tree); }
    pending.current = { name: nameRef.current, tree: treeRef.current };
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  useEffect(() => {
    // Leaving the page with unsaved edits: ask first (a request can't reliably outlive the page).
    const warn = (e: BeforeUnloadEvent) => {
      if (!pending.current) return;
      flush();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush(); // client-side navigation: the request completes normally
    };
  }, [flush]);

  if (missing) {
    return (
      <div className="editor-msg">
        <p>That template doesn’t exist (the demo store resets when the server restarts).</p>
        <Link className="btn" href="/">Back to templates</Link>
      </div>
    );
  }
  if (!tree) return <div className="editor-msg muted">Loading…</div>;

  const section = tree.find((s) => s.id === selection?.sectionId);
  const subsection = section?.subsections.find((s) => s.id === selection?.subsectionId);
  const totals = countComments(tree);

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
    <div className="editor">
      <aside className="editor__side">
        <div className="editor__side-head">
          <Link href="/" className="back"><IconArrowLeft size={18} /> Back to templates</Link>
          <input
            className="editor__name"
            value={name}
            aria-label="Template name"
            onChange={(e) => edit({ name: e.target.value })}
          />
          <span className={`save save--${status}`}>
            {status === "saved" && <><IconCheck size={14} /> Saved</>}
            {status === "saving" && <><IconLoader2 size={14} className="spin" /> Saving…</>}
            {status === "error" && <><IconAlertCircle size={14} /> Couldn’t save — will retry on next edit</>}
          </span>
        </div>
        <TreeNav tree={tree} selection={selection} onSelect={setSelection} onChange={(t) => edit({ tree: t })} />
      </aside>

      <main className="editor__main">
        {subsection && section ? (
          <>
            <SubsectionPanel
              key={subsection.id}
              subsection={subsection}
              sectionName={section.name}
              onOpenSection={() => setSelection({ sectionId: section.id })}
              onChange={(next) => edit({ tree: mapSubsection(tree, section.id, subsection.id, () => next) })}
            />
          </>
        ) : section ? (
          <>
            <EditableTitle
              key={section.id}
              value={section.name}
              fallback="Untitled section"
              label="section"
              onCommit={(name) => edit({ tree: mapSection(tree, section.id, (s) => ({ ...s, name })) })}
            />
            <p className="crumb">Section · {section.subsections.length} subsections</p>
            <section className="card card--list">
              <h2>Subsections</h2>
              {section.subsections.length === 0 && <p className="muted">No subsections yet. Use “Add subsection” in the tree.</p>}
              <ul className="summary">
                {section.subsections.map((sub) => (
                  <li key={sub.id}>
                    <button onClick={() => setSelection({ sectionId: section.id, subsectionId: sub.id })}>
                      <span>{sub.name}</span>
                      <span className="muted">{sub.comments.length} comments</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            <h1>Overview</h1>
            <p className="crumb">Pick a subsection in the tree to add, edit, reorder or delete its comments.</p>
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
          </>
        )}
      </main>
    </div>
    </Tooltip.Provider>
  );
}
