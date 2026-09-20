"use client";

import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import CommentCard from "./CommentCard";
import CommentDialog from "./CommentDialog";
import SortableList from "./Sortable";
import EditableTitle from "./EditableTitle";
import {
  COMMENT_TYPES, newComment, reorderGroup, uid,
  type Comment, type CommentType, type Subsection,
} from "@/lib/template";

export default function SubsectionPanel({
  subsection, sectionName, focusId, onOpenSection, onChange,
}: {
  subsection: Subsection;
  sectionName: string;
  focusId?: string;
  onOpenSection: () => void;
  onChange: (next: Subsection) => void;
}) {
  const { comments } = subsection;
  // The comment being edited, as it was when the dialog opened (edits live in the dialog's draft).
  const [editing, setEditing] = useState<{ comment: Comment; isNew: boolean } | null>(() => {
    const c = focusId ? comments.find((x) => x.id === focusId) : undefined;
    return c ? { comment: c, isNew: false } : null;
  });

  useEffect(() => {
    if (focusId) document.getElementById(`comment-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);
  const setComments = (next: Comment[]) => onChange({ ...subsection, comments: next });

  // A new comment only joins the list when the dialog's "Done" is clicked.
  const add = (type: CommentType) => setEditing({ comment: newComment(type), isNew: true });

  function save(draft: Comment) {
    setComments(editing?.isNew
      ? [...comments, draft]
      : comments.map((c) => (c.id === draft.id ? draft : c)));
    setEditing(null);
  }

  function duplicate(c: Comment) {
    const i = comments.indexOf(c);
    const copy = { ...c, id: uid(), name: `${c.name} (copy)` };
    setComments([...comments.slice(0, i + 1), copy, ...comments.slice(i + 1)]);
  }

  function remove(c: Comment) {
    if (!window.confirm(`Delete “${c.name || "Untitled comment"}”?`)) return;
    setComments(comments.filter((x) => x.id !== c.id));
    if (editing?.comment.id === c.id) setEditing(null);
  }

  return (
    <>
      <EditableTitle
        value={subsection.name}
        fallback="Untitled subsection"
        label="subsection"
        onCommit={(name) => onChange({ ...subsection, name })}
      />
      <nav className="crumb" aria-label="Breadcrumb">
        <button className="crumb__link" onClick={onOpenSection}>{sectionName}</button>
        <IconChevronRight size={14} />
        <span>{subsection.name || "Untitled subsection"}</span>
      </nav>

      {COMMENT_TYPES.map(({ type, label }) => {
        const group = comments.filter((c) => c.type === type);
        return (
          <section key={type} className={`group group--${type}`}>
            <header className="group__head">
              <span className="pill pill--group">{label}</span>
              <span className="pill">{group.length} {group.length === 1 ? "comment" : "comments"}</span>
              <button className="btn group__add" onClick={() => add(type)}>
                <IconPlus size={18} /> New comment
              </button>
            </header>
            {group.length === 0 ? (
              <p className="muted group__empty">No comments yet.</p>
            ) : (
              <SortableList
                className="group__list"
                items={group}
                onReorder={(next) => setComments(reorderGroup(comments, next))}
                render={(c, handle) => (
                  <CommentCard
                    comment={c}
                    handle={handle}
                    onEdit={() => setEditing({ comment: c, isNew: false })}
                    onDuplicate={() => duplicate(c)}
                    onToggleHidden={() => setComments(comments.map((x) => (x.id === c.id ? { ...x, hidden: !x.hidden } : x)))}
                    onDelete={() => remove(c)}
                  />
                )}
              />
            )}
          </section>
        );
      })}

      <CommentDialog
        comment={editing?.comment ?? null}
        isNew={editing?.isNew ?? false}
        onSave={save}
        onDelete={() => editing && remove(editing.comment)}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
