"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Template } from "@/lib/store";

export default function TemplateDialog({
  template,
  mode,
  onSaved,
  children,
}: {
  template: Template;
  mode: "view" | "edit";
  onSaved: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/templates?id=${encodeURIComponent(template.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name") }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="btn">{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title className="modal__title">
            {mode === "edit" ? "Edit template" : template.name}
          </Dialog.Title>
          <Dialog.Description className="modal__desc">
            {mode === "edit" ? "Rename this template." : "Template content"}
          </Dialog.Description>
          {mode === "view" ? (
            <>
              <pre className="modal__content">{template.content}</pre>
              <div className="form__actions">
                <Dialog.Close className="btn btn--primary">Close</Dialog.Close>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="form">
              <label>
                Name
                <input name="name" defaultValue={template.name} required autoFocus />
              </label>
              {error && <p className="form__error">{error}</p>}
              <div className="form__actions">
                <Dialog.Close className="btn" type="button">Cancel</Dialog.Close>
                <button className="btn btn--primary" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
