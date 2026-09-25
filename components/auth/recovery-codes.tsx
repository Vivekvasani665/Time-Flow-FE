"use client";

import { AlertTriangle, Check, Copy, Download } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Could not copy", { description: "Select the text and copy it manually." });
  }
}

function downloadCodes(codes: string[]) {
  const body = [
    "TimeFlow two-factor recovery codes",
    `Generated ${new Date().toLocaleString()}`,
    "",
    "Each code can be used once, in place of your authenticator app or passkey.",
    "",
    ...codes,
    "",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "timeflow-recovery-codes.txt";
  link.click();
  URL.revokeObjectURL(url);
}

/** Freshly generated codes. The API never returns them again, so this is the only chance to save them. */
export function RecoveryCodes({ codes, onDone, doneLabel = "I've saved them", doneIcon }: { codes: string[]; onDone: () => void; doneLabel?: string; doneIcon?: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-dim">
        Save these codes somewhere safe. Each one signs you in once if you lose access to your authenticator app or passkey.
      </p>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel-2 p-4 font-mono text-sm text-ink">
        {codes.map((c) => (
          <li key={c} className="tabular">
            {c}
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2.5 text-sm text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
        These codes will not be shown again.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => void copyText(codes.join("\n"), "Recovery codes")}>
          Copy
        </Button>
        <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadCodes(codes)}>
          Download
        </Button>
        <Button icon={doneIcon ?? <Check className="size-4" />} onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

/** The QR code plus the "Can't scan?" fallback key. Used in Settings and on the login page. */
export function TotpQr({ qrCodeDataUrl, secret, showKey, onShowKey }: { qrCodeDataUrl: string; secret: string; showKey: boolean; onShowKey: () => void }) {
  const groupedKey = secret.match(/.{1,4}/g)?.join(" ") ?? "";
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        {/* A data URL made by the API; next/image adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCodeDataUrl} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg border border-line bg-white p-2" />
      </div>
      {showKey ? (
        <div className="space-y-2 rounded-lg border border-line bg-panel-2 p-3">
          <p className="text-xs text-ink-mute">Enter this key in your app, choosing a time-based code:</p>
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-sm break-all text-ink">{groupedKey}</code>
            <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => void copyText(secret, "Setup key")}>
              Copy
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-mute">
          Can&apos;t scan?{" "}
          <button type="button" className="font-medium text-cyan hover:underline" onClick={onShowKey}>
            Show setup key
          </button>
        </p>
      )}
    </div>
  );
}
