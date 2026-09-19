"use client";

import {
  IconArrowBackUp, IconArrowForwardUp, IconBold, IconItalic, IconLink, IconList,
  IconListNumbers, IconUnderline, type Icon,
} from "@tabler/icons-react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Tip from "./Tip";

/** Rich text box for comment text. Value in / out is an HTML string. */
export default function RichTextEditor({
  value, onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    editorProps: { attributes: { class: "rte__content", "aria-label": "Comment text" } },
  });

  return (
    <div className="rte">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
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

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove)", previous ?? "https://");
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url.trim() === "") chain.unsetLink().run();
    else chain.setLink({ href: url.trim() }).run();
  }

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
      {btn("Link", IconLink, s.link, setLink)}
      <span className="rte__sep" />
      {btn("Undo", IconArrowBackUp, false, () => editor.chain().focus().undo().run(), !s.canUndo)}
      {btn("Redo", IconArrowForwardUp, false, () => editor.chain().focus().redo().run(), !s.canRedo)}
    </div>
  );
}
