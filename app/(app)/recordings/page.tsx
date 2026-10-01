import type { Metadata } from "next";
import { Suspense } from "react";
import { RecordingsPage } from "@/components/recordings/recordings-page";

export const metadata: Metadata = { title: "Recordings" };

/** Open to every signed-in user; the API scopes which recordings each person sees. */
export default function Page() {
  return (
    <Suspense>
      <RecordingsPage />
    </Suspense>
  );
}
