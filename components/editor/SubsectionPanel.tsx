"use client";

import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import CommentCard from "./CommentCard";
import CommentDialog from "./CommentDialog";
import SortableList from "./Sortable";
import EditableTitle from "./EditableTitle";
import {
  COMMENT_TYPES, newComment, plainText, reorderGroup, uid,
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
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(focusId ?? null);
  const { comments } = subsection;

  useEffect(() => {
    if (focusId) document.getElementById(`comment-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);
  const setComments = (next: Comment[]) => onChange({ ...subsection, comments: next });

  const patch = (id: string, p: Partial<Comment>) =>
    setComments(comments.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function add(type: CommentType) {
    const c = newComment(type);
    setComments([...comments, c]);
    setEditingId(c.id);
    setIsNew(true);
  }

  function closeDialog() {
    // A brand-new comment that was never filled in is dropped rather than left as a blank card.
    const c = comments.find((x) => x.id === editingId);
    if (isNew && c && !c.name.trim() && !plainText(c.text)) setComments(comments.filter((x) => x !== c));
    setEditingId(null);
    setIsNew(false);
  }

  function duplicate(c: Comment) {
    const i = comments.indexOf(c);
    const copy = { ...c, id: uid(), name: `${c.name} (copy)` };
    setComments([...comments.slice(0, i + 1), copy, ...comments.slice(i + 1)]);
  }

  function remove(c: Comment) {
    if (!window.confirm(`Delete “${c.name || "Untitled comment"}”?`)) return;
    setComments(comments.filter((x) => x.id !== c.id));
    if (editingId === c.id) closeDialog();
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
                    onEdit={() => setEditingId(c.id)}
                    onDuplicate={() => duplicate(c)}
                    onDelete={() => remove(c)}
                  />
                )}
              />
            )}
          </section>
        );
      })}

      {(() => {
        const editing = comments.find((c) => c.id === editingId) ?? null;
        return (
          <CommentDialog
            comment={editing}
            onChange={(p) => editing && patch(editing.id, p)}
            onDelete={() => editing && remove(editing)}
            onClose={closeDialog}
          />
        );
      })()}
    </>
  );
}
