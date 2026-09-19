"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-line-bright bg-panel shadow-sm transition-colors",
        "hover:border-ink-mute data-[state=checked]:border-cyan data-[state=checked]:bg-cyan data-[state=checked]:text-white",
        "data-[state=indeterminate]:border-cyan data-[state=indeterminate]:bg-cyan data-[state=indeterminate]:text-white",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-current">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3.5} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
