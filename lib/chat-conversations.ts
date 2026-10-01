import { ASSISTANT_CONVERSATION_ID, type ChatConversation } from "@/types/chat";

/**
 * The conversations every user starts with. Only real ones: the AI assistant
 * and `# General`, the live Global Chat served by the API and socket. Direct
 * messages are opened with real team members (see `useChatWorkspace`).
 */

/** The real Global Chat. Its messages come from /api/chat/messages. */
export const LIVE_CHANNEL_ID = "channel-general";

export const directConversationId = (contactId: string) => `dm-${contactId}`;

export const INITIAL_CONVERSATIONS: ChatConversation[] = [
  // The AI assistant: served by /api/assistant. Pinned above everything else.
  {
    id: ASSISTANT_CONVERSATION_ID,
    kind: "assistant",
    name: "TimeFlow Assistant",
    description: "AI · Answers from your projects and tasks",
    visibility: null,
    contact: null,
    unread: 0,
    muted: false,
    lastMessage: null,
    live: false,
  },
  {
    id: LIVE_CHANNEL_ID,
    kind: "channel",
    name: "General",
    description: "Everyone in TimeFlow",
    visibility: "public",
    contact: null,
    unread: 0,
    muted: false,
    lastMessage: null,
    live: true,
  },
];
