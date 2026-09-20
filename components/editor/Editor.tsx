"use client";

import { IconAlertCircle, IconArrowLeft, IconCheck, IconDeviceFloppy, IconFileExport, IconLoader2 } from "@tabler/icons-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ExportDialog from "./ExportDialog";
import EditableTitle from "./EditableTitle";
import OverviewPanel from "./OverviewPanel";
import { downloadPdf } from "@/lib/exportPdf";
import { downloadXls } from "@/lib/exportTemplate";
import SubsectionPanel from "./SubsectionPanel";
import TreeNav, { type Selection } from "./TreeNav";
import { mapSection, mapSubsection, remapIds, type Section } from "@/lib/template";
import "@/styles/editor.scss";

type Status = "idle" | "saving" | "saved" | "error";

// Asks the server to pick icons for the template's sections (LLM, stored in the database).
// Best-effort: on failure the sections just show the placeholder icon. Never throws.
async function matchSectionIcons(id: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`/api/templates/icons?id=${encodeURIComponent(id)}`, { method: "POST" });
    return res.ok ? (await res.json()).icons ?? {} : {};
  } catch {
    return {};
  }
}

export default function Editor({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [tree, setTree] = useState<Section[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [settingUp, setSettingUp] = useState(false); // first open: icons are being chosen

  // Refs mirror state so back-to-back edits in one tick merge into the latest values.
  const nameRef = useRef("");
  const treeRef = useRef<Section[]>([]);
  const version = useRef(0); // bumps on every edit, so a save can tell if newer edits arrived mid-flight

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`);
        if (!res.ok) return void (!cancelled && setMissing(true));
        const doc = await res.json();
        let loaded: Section[] = doc.tree ?? [];
        if (!doc.iconsResolved && loaded.length > 0) {
          setSettingUp(true);
          const icons = await matchSectionIcons(id);
          loaded = loaded.map((s) => (icons[s.id] ? { ...s, icon: icons[s.id] } : s));
        }
        if (cancelled) return;
        nameRef.current = doc.name;
        treeRef.current = loaded;
        setName(doc.name);
        setTree(loaded);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const edit = useCallback((next: { name?: string; tree?: Section[] }) => {
    if (next.name !== undefined) { nameRef.current = next.name; setName(next.name); }
    if (next.tree) { treeRef.current = next.tree; setTree(next.tree); }
    version.current++;
    setDirty(true);
    setStatus("idle");
  }, []);

  const save = useCallback(async () => {
    const saved = version.current;
    setStatus("saving");
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameRef.current, tree: treeRef.current }),
      });
      if (!res.ok) throw new Error();
      // New rows got database ids; swap them in (edits made while saving keep their own).
      const { idMap }: { idMap: Record<string, string> } = await res.json();
      if (Object.keys(idMap).length > 0) {
        treeRef.current = remapIds(treeRef.current, idMap);
        setTree(treeRef.current);
        setSelection((sel) => sel && {
          sectionId: idMap[sel.sectionId] ?? sel.sectionId,
          subsectionId: sel.subsectionId && (idMap[sel.subsectionId] ?? sel.subsectionId),
          commentId: sel.commentId && (idMap[sel.commentId] ?? sel.commentId),
        });
      }
      if (version.current === saved) setDirty(false);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [id]);

  const [exportOpen, setExportOpen] = useState(false);

  // Hide the "Saved" confirmation after a moment.
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 1800);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && status !== "saving") save();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", onKey);
    };
  }, [dirty, status, save]);

  if (missing) {
    return (
      <div className="editor-msg">
        <p>That template doesn’t exist.</p>
        <Link className="btn" href="/">Back to templates</Link>
      </div>
    );
  }
  if (!tree) {
    return (
      <div className="editor-msg muted" role="status">
        <IconLoader2 size={28} className="spin" />
        <p>{settingUp ? "Setting up your template…" : "Loading…"}</p>
        {settingUp && <p className="muted">Choosing icons for each section. This only happens once.</p>}
      </div>
    );
  }

  const section = tree.find((s) => s.id === selection?.sectionId);
  const subsection = section?.subsections.find((s) => s.id === selection?.subsectionId);

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
    <div className="editor">
      <aside className="editor__side">
        <div className="editor__side-head">
          <Link
            href="/"
            className="back"
            onClick={(e) => {
              if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
            }}
          >
            <IconArrowLeft size={18} /> Back to templates
          </Link>
          <input
            className="editor__name"
            value={name}
            aria-label="Template name"
            onChange={(e) => edit({ name: e.target.value })}
          />
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
              focusId={selection?.commentId}
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
          <OverviewPanel
            tree={tree}
            onOpen={(sectionId, subsectionId, commentId) => setSelection({ sectionId, subsectionId, commentId })}
          />
        )}
      </main>

      <div className="fab" role="toolbar" aria-label="Template actions">
        {status === "error" && (
          <span className="fab__error"><IconAlertCircle size={16} /> Couldn’t save. Try again.</span>
        )}
        {status === "saved" && !dirty && (
          <span className="fab__ok"><IconCheck size={15} /> Saved</span>
        )}
        <button className="btn btn--primary" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving"
            ? <><IconLoader2 size={16} className="spin" /> Saving…</>
            : <><IconDeviceFloppy size={16} /> Save</>}
        </button>
        <span className="fab__divider" aria-hidden />
        <button className="btn" onClick={() => setExportOpen(true)}>
          <IconFileExport size={16} /> Export
        </button>
      </div>
    </div>
    <ExportDialog
      open={exportOpen}
      onOpenChange={setExportOpen}
      onPdf={() => {
        downloadPdf(nameRef.current, tree);
        setExportOpen(false);
      }}
      onXls={() => {
        downloadXls(nameRef.current, tree);
        setExportOpen(false);
      }}
    />
    </Tooltip.Provider>
  );
}
