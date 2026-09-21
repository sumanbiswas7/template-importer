"use client";

import {
  IconCalendar, IconChevronDown, IconCopy, IconExternalLink, IconEdit, IconHome, IconLoader2,
  IconSearch, IconSortDescending, IconTrash, IconUpload, IconUser,
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImportDialog from "./ImportDialog";
import TemplateDialog from "./TemplateDialog";
import { templateIcon } from "@/lib/icons";
import type { Template } from "@/lib/store";

type Sort = "newest" | "oldest" | "az" | "za";

const sorters: Record<Sort, (a: Template, b: Template) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  az: (a, b) => a.name.localeCompare(b.name),
  za: (a, b) => b.name.localeCompare(a.name),
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const body = await res.json();
      if (!res.ok || !Array.isArray(body)) throw new Error(body?.error ?? "Couldn’t load templates.");
      setTemplates(body);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn’t load templates.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Rows with a request in flight, so the button can show a spinner and can't be double-clicked.
  const [busy, setBusy] = useState<Record<string, "duplicating" | "deleting">>({});
  const track = async (id: string, kind: "duplicating" | "deleting", run: () => Promise<Response>) => {
    setBusy((b) => ({ ...b, [id]: kind }));
    try {
      const res = await run();
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Something went wrong.");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy((b) => { const { [id]: _, ...rest } = b; return rest; });
    }
  };

  const remove = (id: string) =>
    track(id, "deleting", () => fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" }));

  // The server copies it, so the whole tree doesn't travel to the browser and back.
  const duplicate = (t: Template) =>
    track(t.id, "duplicating", () => fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyOf: t.id }),
    }));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (templates ?? [])
      .filter((t) => !q || `${t.name} ${t.content}`.toLowerCase().includes(q))
      .sort(sorters[sort]);
  }, [templates, query, sort]);

  const empty = templates?.length === 0;

  return (
    <>
      <nav className="navbar">
        <div className="navbar__brand">
          <span className="navbar__logo"><IconHome size={22} /></span>
          Template Importer
        </div>
        <div className="navbar__actions">
          {!empty && <ImportDialog onImported={load} />}
          <button className="user-btn" aria-label="Account">
            <span className="user-btn__avatar"><IconUser size={18} /></span>
            <IconChevronDown size={16} />
          </button>
        </div>
      </nav>

      <main className="page">
        {loadError && templates === null ? (
          <p className="muted">{loadError}</p>
        ) : templates === null ? (
          <p className="muted">Loading…</p>
        ) : empty ? (
          <ImportDialog onImported={load} className="import-big">
            <span className="import-big__icon"><IconUpload size={40} /></span>
            <span className="import-big__title">Import a template</span>
            <span className="import-big__hint">Upload an .xls or .xlsx to get started</span>
          </ImportDialog>
        ) : (
          <section className="library">
            <h1>My templates</h1>
            <p className="library__sub">Manage, edit, and duplicate your inspection templates.</p>

            <div className="toolbar">
              <label className="search">
                <IconSearch size={20} />
                <input
                  type="search"
                  placeholder="Search templates..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="select">
                <IconSortDescending size={18} />
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label="Sort templates">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">Name A–Z</option>
                  <option value="za">Name Z–A</option>
                </select>
                <IconChevronDown size={18} />
              </label>
            </div>

            {visible.length === 0 ? (
              <p className="muted no-results">No templates match “{query}”.</p>
            ) : (
              <ul className="list">
                {visible.map((t) => {
                  const Icon = templateIcon(t.name);
                  const state = busy[t.id];
                  return (
                    <li key={t.id} className="row" aria-busy={!!state} style={state ? { opacity: 0.6 } : undefined}>
                      <span className="row__icon"><Icon size={26} /></span>
                      <div className="row__body">
                        <h2>{t.name}</h2>
                        <p>{t.content}</p>
                        <time>
                          <IconCalendar size={16} />
                          {new Date(t.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </time>
                      </div>
                      <div className="row__actions">
                        <Link className="btn" href={`/templates/${t.id}`}>
                          <IconExternalLink size={18} /> Open
                        </Link>
                        <TemplateDialog template={t} mode="edit" onSaved={load}>
                          <IconEdit size={18} /> Edit
                        </TemplateDialog>
                        <button className="btn" disabled={!!state} onClick={() => duplicate(t)}>
                          {state === "duplicating"
                            ? <><IconLoader2 size={18} className="spin" /> Duplicating…</>
                            : <><IconCopy size={18} /> Duplicate</>}
                        </button>
                        <button className="btn btn--icon btn--danger" aria-label={`Delete ${t.name}`}
                          disabled={!!state} onClick={() => remove(t.id)}>
                          {state === "deleting" ? <IconLoader2 size={18} className="spin" /> : <IconTrash size={18} />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  );
}
