"use client";

import { IconEdit } from "@tabler/icons-react";
import { useState } from "react";
import Tip from "./Tip";

/** Page heading with a pencil button that swaps it for a text box. */
export default function EditableTitle({
  value, fallback, label, onCommit,
}: {
  value: string;
  fallback: string;
  label: string; // e.g. "subsection"
  onCommit: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <header className="title">
      {editing ? (
        <input
          className="title__input"
          autoFocus
          aria-label={`${label} title`}
          defaultValue={value}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            setEditing(false);
            const name = e.target.value.trim();
            if (name && name !== value) onCommit(name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <>
          <h1>{value || fallback}</h1>
          <Tip label="Edit title">
            <button className="icon-btn" aria-label={`Edit ${label} title`} onClick={() => setEditing(true)}>
              <IconEdit size={20} />
            </button>
          </Tip>
        </>
      )}
    </header>
  );
}
