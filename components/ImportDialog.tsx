"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";

export default function ImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), content: data.get("content") }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong.");
      return;
    }
    form.reset();
    setOpen(false);
    onImported();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="btn btn--primary">Import template</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title className="modal__title">Import template</Dialog.Title>
          <Dialog.Description className="modal__desc">
            Give it a name and paste the template content.
          </Dialog.Description>
          <form onSubmit={submit} className="form">
            <label>
              Name
              <input name="name" required autoFocus />
            </label>
            <label>
              Content
              <textarea name="content" rows={6} required />
            </label>
            {error && <p className="form__error">{error}</p>}
            <div className="form__actions">
              <Dialog.Close className="btn" type="button">Cancel</Dialog.Close>
              <button className="btn btn--primary" disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
