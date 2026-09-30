"use client";

import { Hash, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreateChannelInput } from "@/types/chat";

type CreateChannelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNameTaken: (name: string) => boolean;
  onCreate: (input: CreateChannelInput) => void;
};

const NAME_MAX = 40;
const DESCRIPTION_MAX = 160;

const VISIBILITY = [
  { value: "public", label: "Public", hint: "Anyone in TimeFlow can find and join", icon: Hash },
  { value: "private", label: "Private", hint: "Only people you invite can see it", icon: Lock },
] as const;

const EMPTY: CreateChannelInput = { name: "", description: "", visibility: "public" };

export function CreateChannelDialog({ open, onOpenChange, isNameTaken, onCreate }: CreateChannelDialogProps) {
  const [form, setForm] = useState<CreateChannelInput>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const name = form.name.trim();
  const nameError = !name
    ? "Channel name is required"
    : name.length < 2
      ? "Channel name must be at least 2 characters"
      : name.length > NAME_MAX
        ? `Channel name must be at most ${NAME_MAX} characters`
        : isNameTaken(name)
          ? "A channel with this name already exists"
          : undefined;
  const descriptionError = form.description.length > DESCRIPTION_MAX ? `Description must be at most ${DESCRIPTION_MAX} characters` : undefined;
  const shownNameError = submitted ? nameError : undefined;

  const close = (next: boolean) => {
    if (!next) {
      setForm(EMPTY);
      setSubmitted(false);
    }
    onOpenChange(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || descriptionError) return;
    onCreate({ ...form, name });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close} title="Create channel" description="Channels are where your team talks about a topic or project.">
      <form id="create-channel-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Channel name" htmlFor="channel-name" error={shownNameError} required>
          <div className="relative">
            <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
            <Input
              {...fieldA11y("channel-name", shownNameError)}
              autoFocus
              value={form.name}
              maxLength={NAME_MAX + 10}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Design Reviews"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Description" htmlFor="channel-description" error={descriptionError} hint="Optional — what is this channel about?">
          <Textarea
            {...fieldA11y("channel-description", descriptionError)}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="min-h-16"
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Channel type</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {VISIBILITY.map(({ value, label, hint, icon: Icon }) => {
              const checked = form.visibility === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan/40",
                    checked ? "border-cyan bg-cyan/5" : "border-line-bright hover:bg-panel-2",
                  )}
                >
                  <input
                    type="radio"
                    name="channel-visibility"
                    value={value}
                    checked={checked}
                    onChange={() => setForm((f) => ({ ...f, visibility: value }))}
                    className="mt-0.5 accent-[var(--color-cyan)]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <Icon className="size-3.5" aria-hidden="true" /> {label}
                    </span>
                    <span className="block text-xs text-ink-mute">{hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </form>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => close(false)}>
          Cancel
        </Button>
        <Button type="submit" form="create-channel-form">
          Create channel
        </Button>
      </div>
    </Dialog>
  );
}
