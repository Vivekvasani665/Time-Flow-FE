"use client";

import { AlertTriangle, CheckCircle2, Mail, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useDisableMailSettings, useMailSettings, useSaveMailSettings, useTestMailSettings } from "@/hooks/use-mail-settings";
import { isApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";

const APP_PASSWORD_URL = "https://myaccount.google.com/apppasswords";

/** Google shows the app password in four groups of four. */
const normalise = (v: string) => v.replace(/\s+/g, "");

export function MailAccountPanel() {
  const settings = useMailSettings();
  const test = useTestMailSettings();
  const save = useSaveMailSettings();
  const disable = useDisableMailSettings();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("TimeFlow");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const data = settings.data;
  useEffect(() => {
    if (!data?.configured) return;
    setUsername(data.username ?? "");
    setFromName(data.fromName ?? "TimeFlow");
  }, [data]);

  // An existing account can be re-saved without retyping the password.
  const pass = normalise(password);
  const validate = () => {
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) next.username = "Enter the Gmail address";
    if (!data?.passwordSet && pass.length === 0) next.password = "An app password is required";
    else if (pass.length > 0 && pass.length !== 16) next.password = `App passwords are 16 characters (this is ${pass.length})`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const busy = test.isPending || save.isPending || disable.isPending;

  return (
    <Panel
      title="Email delivery"
      icon={<Mail />}
      actions={
        data?.configured ? (
          <Badge tone={data.enabled ? "lime" : "gray"}>
            {data.enabled ? "Active" : "Disabled"}
          </Badge>
        ) : (
          <Badge tone="amber">Not configured</Badge>
        )
      }
    >
      {settings.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : settings.error ? (
        <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-dim">
            The Gmail account TimeFlow sends from. Until this is set, mail falls back to whatever the server&apos;s{" "}
            <code className="font-mono text-xs text-ink-mute">SMTP_*</code> variables point at.
          </p>

          {data?.configured && data.enabled && (
            <p className="flex items-center gap-2 text-xs text-lime">
              <CheckCircle2 className="size-3.5" />
              Sending as {data.fromName} &lt;{data.fromAddress}&gt;
              {data.lastVerifiedAt && <span className="text-ink-mute">· verified {formatDateTime(data.lastVerifiedAt)}</span>}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gmail address" htmlFor="mail-username" required error={errors.username}>
              <Input
                id="mail-username"
                type="email"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@gmail.com"
                aria-invalid={Boolean(errors.username)}
              />
            </Field>

            <Field label="Sender name" htmlFor="mail-from-name">
              <Input id="mail-from-name" value={fromName} maxLength={80} onChange={(e) => setFromName(e.target.value)} placeholder="TimeFlow" />
            </Field>
          </div>

          <Field
            label="App password"
            htmlFor="mail-password"
            required={!data?.passwordSet}
            error={errors.password}
            hint={
              data?.passwordSet
                ? "Saved. Leave blank to keep it, or paste a new one to replace it."
                : "16 characters from Google — not your normal password."
            }
          >
            <Input
              id="mail-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={data?.passwordSet ? "••••••••••••••••" : "abcd efgh ijkl mnop"}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          <p className="text-xs text-ink-mute">
            Needs 2-Step Verification on the account.{" "}
            <a href={APP_PASSWORD_URL} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
              Create an app password
            </a>
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button
              variant="secondary"
              icon={<PlugZap className="size-4" />}
              loading={test.isPending}
              disabled={busy}
              onClick={() => {
                if (!validate()) return;
                test.mutate(
                  { username: username.trim(), password: pass || undefined },
                  {
                    onSuccess: (r) =>
                      r.ok
                        ? toast.success("Gmail accepted the credentials")
                        : toast.error("Connection failed", { description: r.message }),
                    onError: (e) => toast.error("Could not test", { description: isApiError(e) ? e.message : "Try again." }),
                  },
                );
              }}
            >
              Test connection
            </Button>

            <Button
              loading={save.isPending}
              disabled={busy}
              onClick={() => {
                if (!validate()) return;
                save.mutate(
                  { username: username.trim(), password: pass || undefined, fromName: fromName.trim() || "TimeFlow", enabled: true },
                  {
                    onSuccess: () => {
                      setPassword("");
                      toast.success("Email account saved", { description: "TimeFlow will send from this address." });
                    },
                    // The server verifies before saving, so a failure here is a real credential problem.
                    onError: (e) => toast.error("Not saved", { description: isApiError(e) ? e.message : "Try again." }),
                  },
                );
              }}
            >
              {data?.configured ? "Save changes" : "Save and activate"}
            </Button>

            {data?.configured && data.enabled && (
              <Button
                variant="ghost"
                disabled={busy}
                loading={disable.isPending}
                onClick={() =>
                  disable.mutate(undefined, {
                    onSuccess: () => toast.success("Disabled", { description: "Falling back to the server's SMTP settings." }),
                    onError: (e) => toast.error("Could not disable", { description: isApiError(e) ? e.message : "Try again." }),
                  })
                }
              >
                Disable
              </Button>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            The password is encrypted before it is stored and is never sent back to the browser. Saving verifies it with Gmail
            first, so a wrong password is rejected rather than written.
          </p>
        </div>
      )}
    </Panel>
  );
}
