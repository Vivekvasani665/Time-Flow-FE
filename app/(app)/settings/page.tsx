import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

// No permission gate: these are every user's own preferences.
export default function SettingsPage() {
  return <SettingsView />;
}
