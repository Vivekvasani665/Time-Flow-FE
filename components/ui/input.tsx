import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("field-input h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("field-input min-h-24 resize-y", className)} {...props} />;
}

export function InputWithIcon({ icon, className, ...props }: ComponentProps<"input"> & { icon: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-ink-mute">{icon}</span>
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
