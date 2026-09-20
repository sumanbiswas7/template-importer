"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  IconTrash, IconX, IconRestore, IconAlertTriangle, IconArrowDown, IconArrowUp, IconCalendar, IconCheckbox, IconCircleOff,
  IconEqual, IconHash, IconInfoCircle, IconLock, IconQuestionMark, IconArrowsHorizontal,
  IconToggleLeft, IconTypography,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import RichTextEditor from "./RichTextEditor";
import Segmented, { type SegOption } from "./Segmented";
import type { Category, Comment, CommentType } from "@/lib/template";

const TYPE_OPTIONS: SegOption<CommentType>[] = [
  { value: "defect", label: "Defect", icon: IconAlertTriangle, color: "var(--c-defect)" },
  { value: "info", label: "Information", icon: IconInfoCircle, color: "var(--c-info)" },
  { value: "limit", label: "Limitation", icon: IconLock, color: "var(--c-limit)" },
];

const CATEGORY_OPTIONS: SegOption<string>[] = [
  { value: "none", label: "None", icon: IconCircleOff, color: "#8a8a8a" },
  { value: "-1", label: "Low", icon: IconArrowDown, color: "#3f9b5a" },
  { value: "0", label: "Medium", icon: IconEqual, color: "#d18b1f" },
  { value: "1", label: "High", icon: IconArrowUp, color: "#d9534f" },
];

const ANSWER_ICONS = {
  boolean: IconToggleLeft, checkbox: IconCheckbox, text: IconTypography,
  number: IconHash, range: IconArrowsHorizontal, date: IconCalendar,
};
const answerOptions = (current: string): SegOption<string>[] => {
  const known = Object.keys(ANSWER_ICONS);
  return [...(known.includes(current) ? known : [...known, current])].map((v) => ({
    value: v,
    label: v[0].toUpperCase() + v.slice(1),
    icon: ANSWER_ICONS[v as keyof typeof ANSWER_ICONS] ?? IconQuestionMark,
    color: "var(--c-answer)",
  }));
};

// Edits go to a local draft. Nothing reaches the template until "Done" (which then makes the
// editor's Save button appear); closing any other way discards the draft.
export default function CommentDialog({
  comment, isNew, onSave, onDelete, onClose,
}: {
  comment: Comment | null; // the comment as it was when the dialog opened
  isNew: boolean;
  onSave: (draft: Comment) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Keep showing the last comment while the close animation plays.
  const last = useRef(comment);
  if (comment) last.current = comment;
  const base = comment ?? last.current;

  const [draft, setDraft] = useState<Comment | null>(comment);
  const [draftFor, setDraftFor] = useState(comment?.id);
  const [resets, setResets] = useState(0); // remounts the rich text editor on reset
  if (comment && comment.id !== draftFor) {
    setDraftFor(comment.id);
    setDraft(comment);
  }

  const shown = draft && base && draft.id === base.id ? draft : base;
  const changed = !!shown && !!base && JSON.stringify(shown) !== JSON.stringify(base);
  const patch = (p: Partial<Comment>) => setDraft((d) => (d ? { ...d, ...p } : d));

  function reset() {
    setDraft(base);
    setResets((n) => n + 1);
  }

  function requestClose() {
    if (changed && !window.confirm("Discard your changes to this comment?")) return;
    onClose();
  }

  return (
    <Dialog.Root open={comment !== null} onOpenChange={(open) => !open && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="modal modal--wide"
          aria-describedby={undefined}
          // Escape inside the link bar cancels the link edit, not the whole dialog.
          onEscapeKeyDown={(e) => { if ((e.target as HTMLElement).closest?.("[data-linkbar]")) e.preventDefault(); }}
        >
          {shown && (
            <>
              <div className="modal__bar">
                <Dialog.Title className="modal__title">{isNew ? "New comment" : "Edit comment"}</Dialog.Title>
                <Dialog.Close className="icon-btn" aria-label="Close"><IconX size={20} /></Dialog.Close>
              </div>
              <div className="comment__form">
                <label className="field">
                  Name
                  <input value={shown.name} autoFocus onChange={(e) => patch({ name: e.target.value })} />
                </label>
                <div className="field">
                  <span className="field__label">Comment text</span>
                  <RichTextEditor key={`${shown.id}-${resets}`} value={shown.text} onChange={(text) => patch({ text })} />
                </div>
                <Segmented label="Type" value={shown.type} options={TYPE_OPTIONS} onChange={(type) => patch({ type })} />
                <Segmented label="Category" value={shown.category || "none"} options={CATEGORY_OPTIONS}
                  onChange={(c) => patch({ category: c === "none" ? "" : (c as Category) })} />
                <Segmented label="Answer type" value={shown.answerType}
                  options={answerOptions(shown.answerType)} onChange={(answerType) => patch({ answerType })} />
              </div>
              <div className="form__actions modal__footer">
                {!isNew && (
                  <button className="btn btn--danger" onClick={onDelete}><IconTrash size={18} /> Delete</button>
                )}
                <span className="modal__spacer" />
                <button className="btn" disabled={!changed} onClick={reset}>
                  <IconRestore size={18} /> Reset
                </button>
                <button className="btn btn--primary" onClick={() => onSave(shown)}>Done</button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
