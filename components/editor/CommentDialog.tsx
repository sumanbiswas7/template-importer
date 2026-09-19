"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  IconTrash, IconX, IconAlertTriangle, IconArrowDown, IconArrowUp, IconCalendar, IconCheckbox, IconCircleOff,
  IconEqual, IconHash, IconInfoCircle, IconLock, IconQuestionMark, IconArrowsHorizontal,
  IconToggleLeft, IconTypography,
} from "@tabler/icons-react";
import { useRef } from "react";
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

// Edits apply live (the editor autosaves); "Done" just closes the dialog.
export default function CommentDialog({
  comment, onChange, onDelete, onClose,
}: {
  comment: Comment | null;
  onChange: (patch: Partial<Comment>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Keep showing the last comment while the close animation plays.
  const last = useRef(comment);
  if (comment) last.current = comment;
  const shown = comment ?? last.current;

  return (
    <Dialog.Root open={comment !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal modal--wide" aria-describedby={undefined}>
          {shown && (
            <>
              <div className="modal__bar">
                <Dialog.Title className="modal__title">Edit comment</Dialog.Title>
                <Dialog.Close className="icon-btn" aria-label="Close"><IconX size={20} /></Dialog.Close>
              </div>
              <div className="comment__form">
                <label className="field">
                  Name
                  <input value={shown.name} autoFocus onChange={(e) => onChange({ name: e.target.value })} />
                </label>
                <div className="field">
                  <span className="field__label">Comment text</span>
                  <RichTextEditor key={shown.id} value={shown.text} onChange={(text) => onChange({ text })} />
                </div>
                <Segmented label="Type" value={shown.type} options={TYPE_OPTIONS} onChange={(type) => onChange({ type })} />
                <Segmented label="Category" value={shown.category || "none"} options={CATEGORY_OPTIONS}
                  onChange={(c) => onChange({ category: c === "none" ? "" : (c as Category) })} />
                <Segmented label="Answer type" value={shown.answerType}
                  options={answerOptions(shown.answerType)} onChange={(answerType) => onChange({ answerType })} />
                <label className="field">
                  Multiple choice options <small>comma-separated</small>
                  <input value={shown.options} onChange={(e) => onChange({ options: e.target.value })} />
                </label>
              </div>
              <div className="form__actions modal__footer">
                <button className="btn btn--danger" onClick={onDelete}><IconTrash size={18} /> Delete</button>
                <Dialog.Close className="btn btn--primary">Done</Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
