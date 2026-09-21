"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { IconCheck, IconLoader2, IconUpload } from "@tabler/icons-react";
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
  const [phase, setPhase] = useState<"idle" | "reading" | "saving" | "done">("idle");
  const [summary, setSummary] = useState("");
  const busy = phase !== "idle";
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setPhase("reading");
    try {
      // Saved as-is; section icons are chosen the first time the template is opened.
      const tree = await parseTemplateFile(file);
      setPhase("saving");
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, "").trim() || file.name, tree }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn’t save the template. Try again.");
      const created: { id: string } = await res.json();
      const sections = tree.length;
      setSummary(`${sections} ${sections === 1 ? "section" : "sections"} imported from ${file.name}`);
      setPhase("done");
      onImported();
      // Let the success state register before opening the editor.
      await new Promise((r) => setTimeout(r, 1400));
      // Stay on the status screen until the editor takes over (this component unmounts then),
      // so a slow page load doesn't look like nothing happened.
      router.push(`/templates/${created.id}`);
    } catch (err) {
      setPhase("idle");
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <input ref={input} type="file" accept=".xls,.xlsx,.csv" hidden onChange={onFile} />
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy && phase !== "done" ? "Importing…" : (children ?? (
          <>
            <IconUpload size={18} stroke={2} /> Import template
          </>
        ))}
      </button>
      <Dialog.Root open={busy}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content
            className="modal modal--status"
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className={`import-status${phase === "done" ? " import-status--done" : ""}`}>
              <div className="import-status__icon">
                {phase === "done" ? (
                  <IconCheck size={36} stroke={3} />
                ) : (
                  <IconLoader2 size={36} stroke={2} className="spin" />
                )}
              </div>
              <Dialog.Title className="modal__title">
                {phase === "done" ? "Template imported" : phase === "reading" ? "Reading your file…" : "Saving template…"}
              </Dialog.Title>
              <Dialog.Description className="modal__desc">
                {phase === "done" ? `${summary}. Opening the editor…` : "This only takes a moment."}
              </Dialog.Description>
              {phase !== "done" && (
                <ol className="import-status__steps">
                  <li className={phase === "reading" ? "is-active" : "is-done"}>Read spreadsheet</li>
                  <li className={phase === "saving" ? "is-active" : ""}>Save template</li>
                </ol>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
