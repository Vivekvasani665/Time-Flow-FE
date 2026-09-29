"use client";

import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export function ChatEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <EmptyState
      className="h-full"
      icon={<MessagesSquare />}
      title="Welcome to Global Chat"
      description="Start a conversation with your TimeFlow team. Everyone in the workspace can read and reply here."
      action={
        <Button size="sm" onClick={onStart}>
          Send a message
        </Button>
      }
    />
  );
}
