"use client";

import {
  IconAlertTriangle, IconCopy, IconEdit, IconEye, IconEyeOff, IconInfoCircle, IconLock, IconTrash,
  type Icon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import Tip from "./Tip";
import { CATEGORY_LABELS, plainText, type Comment, type CommentType } from "@/lib/template";

export const TYPE_ICON: Record<CommentType, Icon> = {
  defect: IconAlertTriangle,
  info: IconInfoCircle,
  limit: IconLock,
};

export default function CommentCard({
  comment, handle, onEdit, onDuplicate, onToggleHidden, onDelete,
}: {
  comment: Comment;
  handle: ReactNode;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = TYPE_ICON[comment.type];
  return (
    <div id={`comment-${comment.id}`} className={`comment comment--${comment.type}${comment.hidden ? " is-hidden" : ""}`}>
      <div className="comment__head">
        {handle}
        <TypeIcon size={20} className="comment__icon" />
        <button type="button" className="comment__title" onClick={onEdit}>
          <strong>{comment.name || <em>Untitled comment</em>}</strong>
          {plainText(comment.text) && <span>{plainText(comment.text)}</span>}
        </button>
        {comment.category && (
          <span className={`pill pill--cat${comment.category}`}>{CATEGORY_LABELS[comment.category]}</span>
        )}
        <div className="comment__actions">
          <Tip label={comment.hidden ? "Show in export" : "Hide from export"}>
            <button
              className="icon-btn"
              aria-label={comment.hidden ? "Show comment" : "Hide comment"}
              aria-pressed={!!comment.hidden}
              onClick={onToggleHidden}
            >
              {comment.hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </Tip>
          <Tip label="Edit">
            <button className="icon-btn" aria-label="Edit comment" onClick={onEdit}>
              <IconEdit size={18} />
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
    </div>
  );
}
