"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Background, Controls, Handle, Position, ReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import { IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { SectionIcon } from "@/lib/sectionIcons";
import { COMMENT_TYPES, plainText, type CommentType, type Section, type Subsection } from "@/lib/template";
import "@xyflow/react/dist/style.css";

const SLOT = 320; // horizontal space per section column
const LEVEL = 130; // vertical space between the template and its sections
const ROW = 78; // vertical space per subsection
const INDENT = 36; // subsections hang to the right of their section
const PREVIEW = 6;

type RootData = { name: string; sections: number };
type SectionData = { section: Section; open: boolean; toggle: () => void };
type SubData = { sub: Subsection; dimmed: boolean };

const counts = (comments: { type: CommentType }[]) =>
  COMMENT_TYPES.map(({ type, label }) => ({ type, label, n: comments.filter((c) => c.type === type).length }));

function Badges({ comments }: { comments: { type: CommentType }[] }) {
  return (
    <span className="tv__badges">
      {counts(comments).filter((c) => c.n > 0).map((c) => (
        <span key={c.type} className={`tv__badge tv__badge--${c.type}`} title={c.label}>{c.n}</span>
      ))}
    </span>
  );
}

function RootNode({ data }: NodeProps<Node<RootData>>) {
  return (
    <div className="tv__node tv__node--root">
      <strong>{data.name || "Untitled template"}</strong>
      <span className="muted">{data.sections} sections</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function SectionNode({ data: { section, open, toggle } }: NodeProps<Node<SectionData>>) {
  const all = section.subsections.flatMap((s) => s.comments);
  return (
    <button className={`tv__node tv__node--section${section.hidden ? " is-hidden" : ""}`} onClick={toggle}>
      <Handle type="target" position={Position.Top} />
      <SectionIcon icon={section.icon} size={20} />
      <span className="tv__text">
        <strong>{section.name || "Untitled section"}</strong>
        <span className="muted">{section.subsections.length} subsections · {all.length} comments</span>
      </span>
      <Badges comments={all} />
      {section.subsections.length > 0 && (
        <Handle id="subs" type="source" position={Position.Bottom} style={{ left: 18 }} className={open ? "" : "is-collapsed"} />
      )}
    </button>
  );
}

function SubsectionNode({ data: { sub, dimmed } }: NodeProps<Node<SubData>>) {
  const shown = sub.comments.slice(0, PREVIEW);
  return (
    <div className={`tv__node tv__node--sub${dimmed ? " is-hidden" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <span className="tv__text">
        <strong>{sub.name || "Untitled subsection"}</strong>
        <span className="muted">{sub.comments.length} comments</span>
      </span>
      <Badges comments={sub.comments} />
      {sub.comments.length > 0 && (
        <div className="tv__pop nodrag nowheel" role="tooltip">
          <ul>
            {shown.map((c) => (
              <li key={c.id}>
                <i className={`tv__dot tv__dot--${c.type}`} />
                <span>{c.name || plainText(c.text) || "Empty comment"}</span>
              </li>
            ))}
          </ul>
          {sub.comments.length > PREVIEW && <p className="muted">+{sub.comments.length - PREVIEW} more</p>}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { root: RootNode, section: SectionNode, sub: SubsectionNode };

export default function TreeViewDialog({
  open, onOpenChange, name, tree,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  tree: Section[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let col = 0;
    const centers: number[] = [];
    tree.forEach((section) => {
      const isOpen = !collapsed.has(section.id);
      const x = col++ * SLOT;
      centers.push(x);
      if (isOpen) {
        section.subsections.forEach((sub, i) => {
          nodes.push({
            id: sub.id, type: "sub", position: { x: x + INDENT, y: LEVEL + 90 + i * ROW },
            data: { sub, dimmed: !!(sub.hidden || section.hidden) } satisfies SubData,
          });
          edges.push({ id: `${section.id}>${sub.id}`, source: section.id, sourceHandle: "subs", target: sub.id, type: "smoothstep" });
        });
      }
      nodes.push({
        id: section.id, type: "section", position: { x, y: LEVEL },
        data: {
          section, open: isOpen,
          toggle: () => setCollapsed((c) => {
            const next = new Set(c);
            next.has(section.id) ? next.delete(section.id) : next.add(section.id);
            return next;
          }),
        } satisfies SectionData,
      });
      edges.push({ id: `root>${section.id}`, source: "root", target: section.id, type: "smoothstep" });
    });
    const mid = centers.length ? (centers[0] + centers[centers.length - 1]) / 2 : 0;
    nodes.push({ id: "root", type: "root", position: { x: mid + 15, y: 0 }, data: { name, sections: tree.length } satisfies RootData });
    return { nodes, edges };
  }, [tree, name, collapsed]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="tv" aria-describedby={undefined}>
          <div className="modal__bar">
            <Dialog.Title className="modal__title">Template tree</Dialog.Title>
            <span className="muted tv__hint">Click a section to collapse it · hover a subsection to preview its comments</span>
            <Dialog.Close className="icon-btn" aria-label="Close"><IconX size={20} /></Dialog.Close>
          </div>
          <div className="tv__canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.1, minZoom: 0.8, maxZoom: 1.25 }}
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="tv__legend">
            {COMMENT_TYPES.map((t) => (
              <span key={t.type}><i className={`tv__dot tv__dot--${t.type}`} /> {t.label}</span>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
