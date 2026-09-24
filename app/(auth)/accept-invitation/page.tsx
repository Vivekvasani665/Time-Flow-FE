import type { Metadata } from "next";
import { BrandMark } from "@/components/auth/login-screen";
import { AcceptInvitationForm } from "@/components/invitations/accept-invitation-form";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

/** Reached from a link a Super Admin generated and shared: /accept-invitation?token=… */
export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-4 py-10 sm:px-8">
      <div className="w-full max-w-md">
        <BrandMark className="mb-8 justify-center" />
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-[0_20px_50px_-24px_rgb(49_46_129/0.25)] sm:p-10">
          <AcceptInvitationForm token={typeof token === "string" ? token : ""} />
        </div>
        <p className="mt-6 text-center text-xs text-ink-mute">© {new Date().getFullYear()} TimeFlow</p>
      </div>
    </main>
  );
}
