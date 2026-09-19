"use client";

import { useCallback, useEffect, useState } from "react";
import ImportDialog from "./ImportDialog";
import type { Template } from "@/lib/store";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <header className="header">
        <h1>Templates</h1>
        <ImportDialog onImported={load} />
      </header>

      {templates === null ? (
        <p className="muted">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="muted">No templates yet. Import one to get started.</p>
      ) : (
        <ul className="list">
          {templates.map((t) => (
            <li key={t.id} className="card">
              <div>
                <h2>{t.name}</h2>
                <pre>{t.content}</pre>
              </div>
              <button className="btn" onClick={() => remove(t.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
