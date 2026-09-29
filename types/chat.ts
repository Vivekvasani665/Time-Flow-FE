// Mirrors the backend's chat module (src/modules/chat/chat.types.ts).

/** The reactions the API accepts. */
export const CHAT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTIONS)[number];

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export type ChatUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  /** Who reacted — "reacted by me" is derived from this. */
  userIds: string[];
};

export type ChatReplyPreview = {
  id: string;
  /** Empty when the original was deleted. */
  content: string;
  deleted: boolean;
  sender: Omit<ChatUser, "avatarUrl">;
};

export type ChatMessage = {
  id: string;
  /** Empty for a deleted message. */
  content: string;
  sender: ChatUser;
  replyTo: ChatReplyPreview | null;
  reactions: ChatReaction[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Echo of the sender's optimistic id; only present on the sender's own new messages. */
  clientId?: string;
};

/** Local delivery state. Messages from the server have none. */
export type ChatDeliveryStatus = "sending" | "failed";

/** A message as the UI holds it: server messages, plus the sender's own not-yet-confirmed ones. */
export type ChatMessageView = ChatMessage & {
  status?: ChatDeliveryStatus;
  /** Why sending failed, in words for the user. */
  error?: string;
};

export type ChatPage = { items: ChatMessage[]; hasMore: boolean; nextCursor: string | null };

export type ChatUnread = { count: number; lastReadAt: string | null };

export type ChatReactionUpdate = { messageId: string; reactions: ChatReaction[] };

export type ChatTypingEvent = { user: ChatUser; isTyping: boolean };

export type ChatSocketError = {
  code: string;
  message: string;
  statusCode: number;
  details?: { path: string; message: string }[];
  retryAfter?: number;
};

export type ChatAck<T> = { ok: true; data: T } | { ok: false; error: ChatSocketError };

export type ChatConnectionState = "connecting" | "connected" | "reconnecting" | "unauthorized";
