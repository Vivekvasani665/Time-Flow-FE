import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(user: { firstName: string; lastName: string } | null | undefined) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Unassigned";
}

export function initials(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) return "??";
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Date-only fields come back as midnight UTC — format them in UTC so they don't shift a day. */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatDateTime(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** ISO string → value for <input type="date"> */
export function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function timeAgo(value: string, now: number = Date.now()) {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "COMPLETED") return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate.slice(0, 10) < today;
}

export function percent(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** Last 8 hex chars: the most distinctive part of a UUID (seeded ids share a zero prefix). */
export function shortId(id: string) {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}
