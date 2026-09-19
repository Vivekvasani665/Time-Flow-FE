import type { Tone } from "@/lib/labels";

/** Literal class strings per tone so Tailwind can see them at build time. `glow` draws nothing now. */
export const TONE: Record<Tone, { text: string; border: string; bg: string; dot: string; glow: string }> = {
  cyan: {
    text: "text-cyan",
    border: "border-cyan/25",
    bg: "bg-cyan/10",
    dot: "bg-cyan",
    glow: "",
  },
  violet: {
    text: "text-violet",
    border: "border-violet/25",
    bg: "bg-violet/10",
    dot: "bg-violet",
    glow: "",
  },
  magenta: {
    text: "text-magenta",
    border: "border-magenta/25",
    bg: "bg-magenta/10",
    dot: "bg-magenta",
    glow: "",
  },
  lime: {
    text: "text-lime",
    border: "border-lime/25",
    bg: "bg-lime/10",
    dot: "bg-lime",
    glow: "",
  },
  amber: {
    text: "text-amber",
    border: "border-amber/25",
    bg: "bg-amber/10",
    dot: "bg-amber",
    glow: "",
  },
  red: {
    text: "text-danger",
    border: "border-danger/25",
    bg: "bg-danger/10",
    dot: "bg-danger",
    glow: "",
  },
  blue: {
    text: "text-blue",
    border: "border-blue/25",
    bg: "bg-blue/10",
    dot: "bg-blue",
    glow: "",
  },
  gray: {
    text: "text-ink-dim",
    border: "border-line-bright",
    bg: "bg-panel-3",
    dot: "bg-ink-mute",
    glow: "",
  },
};
