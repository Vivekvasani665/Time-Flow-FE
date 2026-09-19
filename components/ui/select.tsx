"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

const ALL = "__all__";

type SelectProps = {
  id?: string;
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
  /** When set, adds a first option that clears the value (for filters). */
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  allLabel,
  disabled,
  className,
  ...aria
}: SelectProps) {
  // "" is Radix's reserved "nothing selected" value: it shows the placeholder.
  // Passing it through (rather than collapsing to undefined) keeps Root controlled
  // for its whole lifetime, instead of flipping uncontrolled -> controlled on first pick.
  const current = value ?? (allLabel ? ALL : "");
  return (
    <SelectPrimitive.Root
      value={current}
      onValueChange={(v) => onValueChange(v === ALL ? undefined : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "field-input flex h-9 items-center justify-between gap-2 text-left text-sm data-[placeholder]:text-ink-mute",
          className,
        )}
        {...aria}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-ink-mute" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow-overlay)]"
        >
          <SelectPrimitive.Viewport className="p-1">
            {allLabel && <Item value={ALL} label={allLabel} />}
            {options.map((option) => (
              <Item key={option.value} value={option.value} label={option.label} />
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Item({ value, label }: SelectOption) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-3 pl-8 text-sm text-ink outline-none select-none data-[highlighted]:bg-panel-3 data-[state=checked]:font-medium"
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2.5 text-cyan">
        <Check className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
