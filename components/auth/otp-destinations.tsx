import { Mail, Smartphone } from "lucide-react";
import type { OtpChannel, OtpDelivery } from "@/services/auth.service";

/**
 * Safe, user-facing reason for a channel the API could not reach. Provider details stay in the
 * server log. The older codes (…_SEND_FAILED) are kept for APIs that still send them.
 */
export function deliveryFailureText(code: string): string {
  switch (code) {
    case "INVALID_PHONE_NUMBER":
      return "SMS verification code could not be sent — the mobile number on this account is not valid.";
    case "SMS_NOT_CONFIGURED":
      return "SMS verification code could not be sent — SMS is not set up on the server yet.";
    case "SMS_BLOCKED_IN_DEVELOPMENT":
      return "SMS verification code could not be sent — real SMS is switched off in this environment.";
    case "SMS_PROVIDER_AUTH_FAILED":
      return "SMS verification code could not be sent — SMS provider authentication failed.";
    case "SMS_PROVIDER_UNAVAILABLE":
      return "SMS verification code could not be sent — the SMS service is unavailable right now.";
    case "SMS_DELIVERY_FAILED":
    case "SMS_SEND_FAILED":
      return "SMS verification code could not be sent.";
    case "EMAIL_DELIVERY_FAILED":
    case "EMAIL_SEND_FAILED":
      return "Email verification code could not be sent.";
    default:
      return "The code could not be sent.";
  }
}

/** Reasons from a 503 whose `details` list each failed channel, joined into one sentence. */
export const deliveryFailureReasons = (details: { message: string }[]) => details.map((d) => deliveryFailureText(d.message)).join(" ");

type Destination = { ok: boolean; text: string };

/**
 * What a channel says about the newest code. With no per-channel report (an older API),
 * `channels` alone decides; with neither, only email is assumed.
 */
export function destinationStatus(channel: OtpChannel, value: string, channels: OtpChannel[] | undefined, delivery: OtpDelivery | undefined): Destination {
  const outcome = delivery?.[channel];
  if (outcome?.status === "failed") return { ok: false, text: deliveryFailureText(outcome.code) };
  const reported = delivery && Object.keys(delivery).length > 0;
  if (outcome?.status === "sent" || (!reported && (channels ?? ["email"]).includes(channel))) return { ok: true, text: `Sent to ${value}` };
  return { ok: false, text: "Newest code not sent here" };
}

/** Channels the newest code reached, from whichever of the API's fields is present. */
export function reachedChannels(channels: OtpChannel[] | undefined, delivery: OtpDelivery | undefined): OtpChannel[] {
  if (delivery && Object.keys(delivery).length > 0) return (["email", "sms"] as const).filter((c) => delivery[c]?.status === "sent");
  return channels ?? ["email"];
}

/** "your email and mobile number", "your email", "your mobile number". */
export function channelPhrase(channels: OtpChannel[]): string {
  const names = channels.map((c) => (c === "email" ? "email" : "mobile number"));
  return names.length ? `your ${names.join(" and ")}` : "you";
}

/**
 * One card per place the code was sent, masked as the API returned it. The SMS card appears
 * only when the account has a mobile number. Status is spelled out, not left to colour.
 */
export function OtpDestinations({
  email,
  phone,
  channels,
  delivery,
  labelSuffix = "",
}: {
  email: string;
  phone?: string | null;
  channels?: OtpChannel[];
  delivery?: OtpDelivery;
  labelSuffix?: string;
}) {
  const rows = [
    { channel: "email" as const, icon: Mail, label: "Email", value: email },
    ...(phone ? [{ channel: "sms" as const, icon: Smartphone, label: "SMS", value: phone }] : []),
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Where the code was sent">
      {rows.map(({ channel, icon: Icon, label, value }) => {
        const status = destinationStatus(channel, value, channels, delivery);
        return (
          <li key={channel} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm">
            <Icon className={status.ok ? "size-4 shrink-0 text-cyan" : "size-4 shrink-0 text-danger"} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium text-ink">
                {label}
                {labelSuffix}
              </span>
              <span className={status.ok ? "block break-all text-xs text-ink-mute" : "block text-xs text-danger"}>{status.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
