"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  /** Digits entered so far, never longer than `length`. */
  value: string;
  onChange: (value: string) => void;
  /** Called once the last digit lands, with the full code. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Id of the first box, so a `<label htmlFor>` can point at the field. */
  id?: string;
  "aria-describedby"?: string;
  label?: string;
};

/**
 * One box per digit. Typing moves right, Backspace moves left, and a pasted or
 * autofilled code fills every box at once. Boxes fill left to right with no
 * gaps, so the value is always a plain prefix of the code.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  id,
  label = "Verification code",
  "aria-describedby": describedBy,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Focus moves before the parent re-renders with the new value, so onFocus
  // reads this instead of the (stale) prop.
  const latest = useRef(value);
  latest.current = value;

  const update = (next: string) => {
    latest.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // Only on mount: refocusing on every change would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleared from outside (e.g. after a wrong code): start again at the first box.
  useEffect(() => {
    if (value === "" && !disabled && refs.current.some((el) => el === document.activeElement)) refs.current[0]?.focus();
  }, [value, disabled]);

  const focusBox = (index: number) => refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  /** Writes `digits` starting at `index` and moves focus past them. */
  const fill = (index: number, digits: string) => {
    const current = latest.current;
    const next = (current.slice(0, index) + digits + current.slice(index + digits.length)).slice(0, length);
    update(next);
    focusBox(index + digits.length);
    if (next.length === length && next !== current) onComplete?.(next);
  };

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={i === 0 ? id : undefined}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={value[i] ?? ""}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          // The first box takes the one-tap code suggestion on iOS/Android.
          autoComplete={i === 0 ? "one-time-code" : "off"}
          className={cn(
            "field-input h-12 w-full min-w-0 max-w-14 rounded-xl p-0 text-center font-mono text-xl font-semibold tabular sm:h-14",
            invalid && "border-danger focus:border-danger",
          )}
          // Boxes fill in order: clicking ahead lands on the next empty one.
          onFocus={(event) => {
            if (i > latest.current.length) focusBox(latest.current.length);
            else event.target.select();
          }}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            if (!digits) return;
            // A typed digit replaces this box; autofill can drop the whole code here.
            const own = latest.current[i];
            fill(i, digits.length > 1 && own && digits.startsWith(own) ? digits.slice(1) : digits);
          }}
          onPaste={(event) => {
            event.preventDefault();
            const digits = event.clipboardData.getData("text").replace(/\D/g, "");
            if (digits) fill(digits.length >= length ? 0 : i, digits);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              // On an empty box, step back and clear the previous digit.
              const current = latest.current;
              const at = current[i] ? i : i - 1;
              if (at < 0) return;
              update(current.slice(0, at));
              focusBox(at);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusBox(i - 1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              focusBox(i + 1);
            }
          }}
        />
      ))}
    </div>
  );
}
