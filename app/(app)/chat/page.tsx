import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatPage } from "@/components/chat/chat-page";

export const metadata: Metadata = { title: "Chat" };

/** Open to every signed-in user; the API enforces who may edit or delete what. */
export default function Page() {
  return (
    <Suspense>
      <ChatPage />
    </Suspense>
  );
}
