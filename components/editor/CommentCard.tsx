"use client";

import {
  IconAlertTriangle, IconCopy, IconEdit, IconInfoCircle, IconLock, IconTrash, IconCheck,
  type Icon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import Tip from "./Tip";
import {
  ANSWER_TYPES, CATEGORY_LABELS, COMMENT_TYPES,
  type Category, type Comment, type CommentType,
} from "@/lib/template";

export const TYPE_ICON: Record<CommentType, Icon> = {
  defect: IconAlertTriangle,
  info: IconInfoCircle,
  limit: IconLock,
};

export default function CommentCard({
  comment, handle, editing, onToggleEdit, onChange, onDuplicate, onDelete,
}: {
  comment: Comment;
  handle: ReactNode;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Partial<Comment>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = TYPE_ICON[comment.type];
  return (
    <div id={`comment-${comment.id}`} className={`comment comment--${comment.type}`}>
      <div className="comment__head">
        {handle}
        <TypeIcon size={20} className="comment__icon" />
        <button type="button" className="comment__title" onClick={onToggleEdit}>
          <strong>{comment.name || <em>Untitled comment</em>}</strong>
          {!editing && comment.text && <span>{comment.text}</span>}
        </button>
        {comment.category && (
          <span className={`pill pill--cat${comment.category}`}>{CATEGORY_LABELS[comment.category]}</span>
        )}
        <div className="comment__actions">
          <Tip label={editing ? "Done editing" : "Edit"}>
            <button className="icon-btn" aria-label={editing ? "Done editing" : "Edit comment"} onClick={onToggleEdit}>
              {editing ? <IconCheck size={18} /> : <IconEdit size={18} />}
            </button>
          </Tip>
          <Tip label="Duplicate">
            <button className="icon-btn" aria-label="Duplicate comment" onClick={onDuplicate}>
              <IconCopy size={18} />
            </button>
          </Tip>
          <Tip label="Delete">
            <button className="icon-btn icon-btn--danger" aria-label="Delete comment" onClick={onDelete}>
              <IconTrash size={18} />
            </button>
          </Tip>
        </div>
      </div>

      {editing && (
        <div className="comment__form">
          <label className="field">
            Name
            <input value={comment.name} autoFocus onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <label className="field">
            Comment text
            <textarea rows={5} value={comment.text} onChange={(e) => onChange({ text: e.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              Type
              <select value={comment.type} onChange={(e) => onChange({ type: e.target.value as CommentType })}>
                {COMMENT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">
              Category
              <select value={comment.category} onChange={(e) => onChange({ category: e.target.value as Category })}>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Answer type
              <select value={comment.answerType} onChange={(e) => onChange({ answerType: e.target.value })}>
                {[...new Set([...ANSWER_TYPES, comment.answerType])].map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            Multiple choice options <small>comma-separated</small>
            <input value={comment.options} onChange={(e) => onChange({ options: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
