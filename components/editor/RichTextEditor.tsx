"use client";

import {
  IconArrowBackUp, IconArrowForwardUp, IconBold, IconCheck, IconEdit, IconExternalLink, IconItalic,
  IconLink, IconLinkOff, IconList, IconListNumbers, IconUnderline, IconX, type Icon,
} from "@tabler/icons-react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import Tip from "./Tip";

/** Turns what the user typed into a safe link target, or null. "example.com" → https://example.com. */
function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : /^[^@/]+@[^@/]+\.[^@/]+$/.test(v) ? `mailto:${v}` : `https://${v}`;
  if (!/^(https?:|mailto:|tel:)/i.test(url)) return null;
  if (/^https?:/i.test(url)) {
    try {
      const { hostname } = new URL(url);
      if (!hostname.includes(".") && hostname !== "localhost") return null;
    } catch {
      return null;
    }
  }
  return url;
}

/** Rich text box for comment text. Value in / out is an HTML string. */
export default function RichTextEditor({
  value, onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    editorProps: {
      attributes: { class: "rte__content", "aria-label": "Comment text" },
      handleKeyDown: (_view, e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
      // Cmd/Ctrl-click opens a link; a plain click just puts the cursor in it (and shows the link bar).
      handleClick: (_view, _pos, e) => {
        if (!e.metaKey && !e.ctrlKey) return false;
        const a = (e.target as HTMLElement).closest("a");
        if (!a?.href) return false;
        window.open(a.href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
  });

  return (
    <div className="rte">
      {editor && <Toolbar editor={editor} onLink={() => setLinkOpen(true)} />}
      {editor && <LinkBar editor={editor} editing={linkOpen} setEditing={setLinkOpen} />}
      <EditorContent editor={editor} />
    </div>
  );
}

// The strip under the toolbar. Editing: its own URL (and, with nothing selected, text) inputs.
// Otherwise, when the cursor is in a link: where it goes, with Open / Edit / Remove.
function LinkBar({
  editor, editing, setEditing,
}: {
  editor: Editor;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const { href } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ href: e.isActive("link") ? String(e.getAttributes("link").href ?? "") : "" }),
  });

  const close = () => {
    setEditing(false);
    editor.commands.focus();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setEditing(false);
  };

  if (editing) return <LinkForm editor={editor} initialHref={href} onClose={close} onRemove={remove} />;
  if (!href) return null;
  return (
    <div className="rte__linkbar">
      <IconLink size={16} className="rte__linkbar-icon" />
      <a className="rte__linkbar-url" href={href} target="_blank" rel="noopener noreferrer" title={href}>{href}</a>
      <a className="rte__linkbar-btn" href={href} target="_blank" rel="noopener noreferrer">
        <IconExternalLink size={15} /> Open
      </a>
      <button type="button" className="rte__linkbar-btn" onClick={() => setEditing(true)}>
        <IconEdit size={15} /> Edit
      </button>
      <button type="button" className="rte__linkbar-btn rte__linkbar-btn--danger" onClick={remove}>
        <IconLinkOff size={15} /> Remove
      </button>
    </div>
  );
}

function LinkForm({
  editor, initialHref, onClose, onRemove,
}: {
  editor: Editor;
  initialHref: string;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(initialHref);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const urlInput = useRef<HTMLInputElement>(null);
  // Nothing selected and not inside a link: there is no text to attach the link to, so ask for some.
  const [needsText] = useState(() => !initialHref && editor.state.selection.empty);

  useEffect(() => {
    urlInput.current?.focus();
    urlInput.current?.select();
  }, []);

  function apply() {
    const target = normalizeUrl(url);
    if (!target) {
      setError("Enter a web address like example.com, or an email address.");
      urlInput.current?.focus();
      return;
    }
    const chain = editor.chain().focus();
    if (needsText) {
      chain.insertContent({ type: "text", text: text.trim() || url.trim(), marks: [{ type: "link", attrs: { href: target } }] }).run();
    } else {
      chain.extendMarkRange("link").setLink({ href: target }).run();
    }
    onClose();
  }

  return (
    <div
      className="rte__linkbar rte__linkbar--form"
      data-linkbar
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); apply(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      }}
    >
      <div className="rte__linkbar-fields">
        {needsText && (
          <input
            type="text" value={text} placeholder="Text to show (optional)" aria-label="Link text"
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <input
          ref={urlInput} type="text" inputMode="url" value={url} placeholder="Paste or type a link"
          aria-label="Link address" aria-invalid={!!error}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
        />
      </div>
      <button type="button" className="rte__linkbar-btn rte__linkbar-btn--primary" onClick={apply}>
        <IconCheck size={15} /> {initialHref ? "Update" : "Add link"}
      </button>
      {initialHref && (
        <button type="button" className="rte__linkbar-btn rte__linkbar-btn--danger" onClick={onRemove}>
          <IconLinkOff size={15} /> Remove
        </button>
      )}
      <button type="button" className="rte__linkbar-btn rte__linkbar-btn--icon" aria-label="Cancel" onClick={onClose}>
        <IconX size={16} />
      </button>
      {error && <p className="rte__linkbar-error" role="alert">{error}</p>}
    </div>
  );
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const btn = (label: string, Icon: Icon, active: boolean, run: () => void, disabled = false) => (
    <Tip label={label}>
      <button
        type="button"
        className={`rte__btn ${active ? "is-active" : ""}`}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={run}
      >
        <Icon size={18} />
      </button>
    </Tip>
  );

  return (
    <div className="rte__toolbar" role="toolbar" aria-label="Formatting">
      {btn("Bold", IconBold, s.bold, () => editor.chain().focus().toggleBold().run())}
      {btn("Italic", IconItalic, s.italic, () => editor.chain().focus().toggleItalic().run())}
      {btn("Underline", IconUnderline, s.underline, () => editor.chain().focus().toggleUnderline().run())}
      <span className="rte__sep" />
      {btn("Bulleted list", IconList, s.bullet, () => editor.chain().focus().toggleBulletList().run())}
      {btn("Numbered list", IconListNumbers, s.ordered, () => editor.chain().focus().toggleOrderedList().run())}
      {btn("Link (⌘K)", IconLink, s.link, onLink)}
      <span className="rte__sep" />
      {btn("Undo", IconArrowBackUp, false, () => editor.chain().focus().undo().run(), !s.canUndo)}
      {btn("Redo", IconArrowForwardUp, false, () => editor.chain().focus().redo().run(), !s.canRedo)}
    </div>
  );
}
