"use client";

import { IconUpload } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { parseTemplateFile } from "@/lib/parseTemplate";

// Not a dialog any more: clicking opens the file picker, then imports and opens the editor.
export default function ImportDialog({
  onImported,
  className = "btn btn--primary",
  children,
}: {
  onImported: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const tree = await parseTemplateFile(file);
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, "").trim() || file.name, tree }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Something went wrong.");
      const created: { id: string } = await res.json();
      onImported();
      router.push(`/templates/${created.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={input} type="file" accept=".xls,.xlsx,.csv" hidden onChange={onFile} />
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Importing…" : (children ?? (
          <>
            <IconUpload size={18} stroke={2} /> Import template
          </>
        ))}
      </button>
    </>
  );
}
