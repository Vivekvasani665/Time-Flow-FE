"use client";

import { AtSign, Send, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserSelect } from "@/components/forms/user-select";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSendEmail } from "@/hooks/use-emails";
import { isApiError } from "@/lib/api/client";

type Errors = Partial<Record<"toUserId" | "toEmail" | "subject" | "body", string>>;

const EMPTY = { toUserId: undefined as string | undefined, toEmail: "", subject: "", body: "" };

/**
 * What a Reply carries over from the message being answered. `to.userId` is
 * null when the other side is outside the team (a reply that came in by email).
 */
export type ReplyContext = {
  id: string;
  subject: string;
  to: { userId: string | null; email: string; name: string };
  quote: string | null;
};

/** "Re:" is not stacked when the subject already carries one. */
const replySubject = (subject: string) => (/^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`);

/** The original, quoted the way every mail client does it. */
const quoted = (author: string, text: string | null) =>
  text ? `\n\n---\n${author} wrote:\n${text.split("\n").map((line) => `> ${line}`).join("\n")}` : "";

/** Anything with a single @ and a dotted domain — the server validates properly. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "member" | "address";

export function ComposeDialog({
  open,
  onOpenChange,
  reply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when answering a message, which fixes the recipient. */
  reply?: ReplyContext | null;
}) {
  const [mode, setMode] = useState<Mode>("member");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const send = useSendEmail();

  // Seeded on open rather than in useState, so reopening Reply on a different
  // message does not keep the first one's draft.
  const replyId = reply?.id;
  useEffect(() => {
    if (!open || !reply) return;
    setMode(reply.to.userId ? "member" : "address");
    setForm({
      toUserId: reply.to.userId ?? undefined,
      toEmail: reply.to.userId ? "" : reply.to.email,
      subject: replySubject(reply.subject),
      body: quoted(reply.to.name, reply.quote),
    });
    setErrors({});
    // `reply` is rebuilt each render; its id is what actually identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyId]);

  const close = () => {
    onOpenChange(false);
    setMode("member");
    setForm(EMPTY);
    setErrors({});
  };

  /** Editing a field clears its complaint, so errors never outlive the problem. */
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const submit = () => {
    const next: Errors = {};
    const address = form.toEmail.trim();
    if (mode === "member" && !form.toUserId) next.toUserId = "Pick a recipient";
    if (mode === "address") {
      if (!address) next.toEmail = "Email address is required";
      else if (!LOOKS_LIKE_EMAIL.test(address)) next.toEmail = "That does not look like an email address";
    }
    if (!form.subject.trim()) next.subject = "Subject is required";
    if (!form.body.trim()) next.body = "Message is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    send.mutate(
      {
        ...(mode === "member" ? { toUserId: form.toUserId } : { toEmail: address }),
        subject: form.subject.trim(),
        body: form.body.trim(),
        ...(reply ? { replyToId: reply.id } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Message sent", {
            description: mode === "member" ? "It is on its way to their inbox." : `Sent to ${address}.`,
          });
          close();
        },
        onError: (e) => toast.error("Could not send", { description: isApiError(e) ? e.message : "Try again." }),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title={reply ? "Reply" : "New message"}
      description={
        reply
          ? `Replying to ${reply.to.name} — it threads under the original.`
          : "Goes straight to their TimeFlow mailbox — and out over email."
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={send.isPending}>
            Cancel
          </Button>
          <Button icon={<Send className="size-4" />} onClick={submit} loading={send.isPending}>
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!reply && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="member">
                <Users className="size-3.5" /> Team member
              </TabsTrigger>
              <TabsTrigger value="address">
                <AtSign className="size-3.5" /> Email address
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === "member" ? (
          <Field label="To" htmlFor="compose-to" required error={errors.toUserId}>
            <UserSelect
              id="compose-to"
              value={form.toUserId}
              onChange={(toUserId) => set("toUserId", toUserId)}
              placeholder="Select a recipient"
              invalid={Boolean(errors.toUserId)}
              disabled={Boolean(reply)}
            />
          </Field>
        ) : (
          <Field
            label="To"
            htmlFor="compose-email"
            required
            error={errors.toEmail}
            hint="Any address. If it belongs to a team member it also lands in their TimeFlow inbox."
          >
            <Input
              id="compose-email"
              type="email"
              value={form.toEmail}
              maxLength={254}
              onChange={(e) => set("toEmail", e.target.value)}
              placeholder="name@example.com"
              aria-invalid={Boolean(errors.toEmail)}
              disabled={Boolean(reply)}
            />
          </Field>
        )}

        <Field label="Subject" htmlFor="compose-subject" required error={errors.subject}>
          <Input
            id="compose-subject"
            value={form.subject}
            maxLength={200}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="What is this about?"
            aria-invalid={Boolean(errors.subject)}
          />
        </Field>

        <Field label="Message" htmlFor="compose-body" required error={errors.body} hint={`${form.body.length}/5000`}>
          <Textarea
            id="compose-body"
            rows={8}
            maxLength={5000}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Write your message…"
            aria-invalid={Boolean(errors.body)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
