import type { Metadata } from "next";
import { ChatLayout } from "@/components/chat/chat-layout";

export const metadata: Metadata = { title: "Global Chat" };

/** Open to every signed-in user; the API enforces who may edit or delete what. */
export default function ChatPage() {
  return <ChatLayout />;
}
