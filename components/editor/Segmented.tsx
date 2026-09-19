"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { Icon } from "@tabler/icons-react";
import type { CSSProperties } from "react";

export type SegOption<T extends string> = { value: T; label: string; icon: Icon; color: string };

/** Single-choice pill group with an icon and color per option. */
export default function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <ToggleGroup.Root
        type="single"
        className="seg"
        aria-label={label}
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
      >
        {options.map(({ value: v, label: text, icon: Icon, color }) => (
          <ToggleGroup.Item key={v} value={v} className="seg__item" style={{ "--c": color } as CSSProperties}>
            <Icon size={17} /> {text}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
