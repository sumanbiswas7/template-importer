"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  IconChevronDown, IconChevronRight, IconDotsVertical, IconEdit, IconHome, IconLayersSubtract,
  IconPlus, IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import SortableList from "./Sortable";
import {
  mapSection, newSection, newSubsection, type Section,
} from "@/lib/template";

export type Selection = { sectionId: string; subsectionId?: string } | null;

export default function TreeNav({
  tree, selection, onSelect, onChange,
}: {
  tree: Section[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onChange: (next: Section[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);

  // Keep the selected section open so the selected row is always visible.
  const selectedSection = selection?.sectionId;
  useEffect(() => {
    if (selectedSection) setExpanded((e) => (e.has(selectedSection) ? e : new Set(e).add(selectedSection)));
  }, [selectedSection]);

  const toggle = (id: string) =>
    setExpanded((e) => {
      const n = new Set(e);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const rename = (id: string, name: string) => {
    setRenaming(null);
    const clean = name.trim();
    if (!clean) return;
    onChange(tree.map((s) => (s.id === id
      ? { ...s, name: clean }
      : { ...s, subsections: s.subsections.map((sub) => (sub.id === id ? { ...sub, name: clean } : sub)) })));
  };

  function addSection() {
    const s = newSection();
    onChange([...tree, s]);
    onSelect({ sectionId: s.id });
    setRenaming(s.id);
  }

  function addSubsection(sectionId: string) {
    const sub = newSubsection();
    onChange(mapSection(tree, sectionId, (s) => ({ ...s, subsections: [...s.subsections, sub] })));
    setExpanded((e) => new Set(e).add(sectionId));
    onSelect({ sectionId, subsectionId: sub.id });
    setRenaming(sub.id);
  }

  function removeSection(s: Section) {
    if (!window.confirm(`Delete section “${s.name}” and its ${s.subsections.length} subsections?`)) return;
    onChange(tree.filter((x) => x.id !== s.id));
    if (selection?.sectionId === s.id) onSelect(null);
  }

  function removeSubsection(sectionId: string, id: string, name: string) {
    if (!window.confirm(`Delete subsection “${name}” and all its comments?`)) return;
    onChange(mapSection(tree, sectionId, (s) => ({ ...s, subsections: s.subsections.filter((x) => x.id !== id) })));
    if (selection?.subsectionId === id) onSelect({ sectionId });
  }

  const label = (id: string, name: string, onClick: () => void) =>
    renaming === id ? (
      <input
        className="tree__rename"
        autoFocus
        defaultValue={name}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => rename(id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setRenaming(null);
        }}
      />
    ) : (
      <button className="tree__label" onClick={onClick} onDoubleClick={() => setRenaming(id)} title={name}>
        {name}
      </button>
    );

  const menu = (id: string, onDelete: () => void) => (
    <Menu.Root>
      <Menu.Trigger className="tree__menu" aria-label="More actions">
        <IconDotsVertical size={18} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={4}>
          <Menu.Item className="menu__item" onSelect={() => setRenaming(id)}>
            <IconEdit size={16} /> Rename
          </Menu.Item>
          <Menu.Item className="menu__item menu__item--danger" onSelect={onDelete}>
            <IconTrash size={16} /> Delete
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );

  return (
    <nav className="tree" aria-label="Template structure">
      <button className={`tree__row tree__overview ${selection === null ? "is-selected" : ""}`} onClick={() => onSelect(null)}>
        <IconHome size={20} /> Overview
      </button>

      <SortableList
        items={tree}
        onReorder={onChange}
        render={(section, handle) => {
          const open = expanded.has(section.id);
          const sectionSelected = selection?.sectionId === section.id && !selection.subsectionId;
          return (
            <div className="tree__section">
              <div className={`tree__row tree__row--section ${sectionSelected ? "is-selected" : ""}`}>
                {handle}
                <button className="tree__chevron" aria-label={open ? "Collapse" : "Expand"} onClick={() => toggle(section.id)}>
                  {open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                </button>
                <IconLayersSubtract size={18} className="tree__icon" />
                {label(section.id, section.name, () => onSelect({ sectionId: section.id }))}
                {menu(section.id, () => removeSection(section))}
              </div>

              {open && (
                <div className="tree__children">
                  <SortableList
                    items={section.subsections}
                    onReorder={(next) => onChange(mapSection(tree, section.id, (s) => ({ ...s, subsections: next })))}
                    render={(sub, subHandle) => (
                      <div className={`tree__row ${selection?.subsectionId === sub.id ? "is-active" : ""}`}>
                        {subHandle}
                        <span className="tree__dot" />
                        {label(sub.id, sub.name, () => onSelect({ sectionId: section.id, subsectionId: sub.id }))}
                        {menu(sub.id, () => removeSubsection(section.id, sub.id, sub.name))}
                      </div>
                    )}
                  />
                  <button className="tree__add" onClick={() => addSubsection(section.id)}>
                    <IconPlus size={16} /> Add subsection
                  </button>
                </div>
              )}
            </div>
          );
        }}
      />

      <button className="tree__add tree__add--root" onClick={addSection}>
        <IconPlus size={16} /> Add section
      </button>
    </nav>
  );
}
