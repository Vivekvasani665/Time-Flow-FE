"use client";

import { MessageSquareText, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

/** Nothing selected yet (wide screens show this beside the list). */
export function ChatEmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <EmptyState
      className="h-full"
      icon={<MessagesSquare />}
      title="Select a conversation"
      description="Choose a channel or direct message from the sidebar to start chatting."
      action={
        <Button size="sm" variant="secondary" onClick={onNewChat}>
          Start a new chat
        </Button>
      }
    />
  );
}

export function ThreadsEmptyState() {
  return (
    <EmptyState
      className="h-full"
      icon={<MessageSquareText />}
      title="Threads are coming soon"
      description="Replies to your messages will be collected here, so you can follow conversations without scrolling back."
    />
  );
}
