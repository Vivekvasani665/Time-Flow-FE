"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { buildMockMessages, directConversationId, INITIAL_CONVERSATIONS, MOCK_CONTACTS } from "@/lib/chat-mock";
import { fullName } from "@/lib/utils";
import type { ChatContact, ChatConversation, ChatMessage, ChatMessageView, ChatUser, CreateChannelInput } from "@/types/chat";
import { useChatUnread } from "./use-chat";

export type ChatSearchResults = {
  people: ChatContact[];
  channels: ChatConversation[];
  messages: { conversation: ChatConversation; message: ChatMessage }[];
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Channels, direct messages and their (mock) messages.
 *
 * TODO(api): this is the seam for the real backend. Load `conversations` from
 * GET /api/chat/conversations and each conversation's messages from
 * GET /api/chat/messages?conversationId=…, and route the mutations below to
 * POST/PATCH/DELETE /api/chat/messages — components only see this hook's
 * return value, so none of them need to change. `# General` is already live
 * (see `useChat`); its unread count here comes from the API.
 */
export function useChatWorkspace() {
  const { user } = useAuth();
  const liveUnread = useChatUnread();
  const [conversations, setConversations] = useState<ChatConversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});

  const me: ChatUser | null = useMemo(
    () => (user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl } : null),
    [user],
  );

  // Seeded once the signed-in user is known, so "your" mock messages are yours.
  useEffect(() => {
    if (me) setMessages((prev) => (Object.keys(prev).length ? prev : buildMockMessages(me)));
  }, [me]);

  const list = useMemo(
    () =>
      conversations.map((c) => {
        if (c.live) return { ...c, unread: liveUnread };
        const last = messages[c.id]?.filter((m) => !m.deletedAt).at(-1);
        return {
          ...c,
          lastMessage: last
            ? { content: last.content, senderName: last.sender.id === me?.id ? "You" : last.sender.firstName, createdAt: last.createdAt }
            : null,
        };
      }),
    [conversations, messages, liveUnread, me?.id],
  );

  const patch = useCallback((id: string, change: Partial<ChatConversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }, []);

  const markRead = useCallback((id: string) => patch(id, { unread: 0 }), [patch]);

  const toggleMute = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c)));
  }, []);

  const createChannel = useCallback((input: CreateChannelInput): string => {
    const id = `channel-${slug(input.name)}-${Date.now().toString(36)}`;
    setConversations((prev) => {
      const channels = prev.filter((c) => c.kind === "channel");
      const created: ChatConversation = {
        id,
        kind: "channel",
        name: input.name.trim(),
        description: input.description.trim() || null,
        visibility: input.visibility,
        contact: null,
        unread: 0,
        muted: false,
        lastMessage: null,
        live: false,
      };
      return [...channels, created, ...prev.filter((c) => c.kind !== "channel")];
    });
    return id;
  }, []);

  /** Opens (creating if needed) the direct conversation with someone. */
  const openDirect = useCallback((contact: ChatContact): string => {
    const id = directConversationId(contact.id);
    setConversations((prev) =>
      prev.some((c) => c.id === id)
        ? prev
        : [
            ...prev,
            {
              id,
              kind: "direct",
              name: fullName(contact),
              description: null,
              visibility: null,
              contact,
              unread: 0,
              muted: false,
              lastMessage: null,
              live: false,
            },
          ],
    );
    return id;
  }, []);

  const channelNameTaken = useCallback(
    (name: string) => conversations.some((c) => c.kind === "channel" && c.name.toLowerCase() === name.trim().toLowerCase()),
    [conversations],
  );

  // ── Mock message mutations ────────────────────────────────
  const update = useCallback((conversationId: string, fn: (list: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => ({ ...prev, [conversationId]: fn(prev[conversationId] ?? []) }));
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, content: string, replyTo: ChatMessageView | null) => {
      if (!me) return;
      const now = new Date().toISOString();
      update(conversationId, (list) => [
        ...list,
        {
          id: `local-${crypto.randomUUID()}`,
          content,
          sender: me,
          replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, deleted: false, sender: replyTo.sender } : null,
          reactions: [],
          editedAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    },
    [me, update],
  );

  const editMessage = useCallback(
    (conversationId: string, id: string, content: string) => {
      const now = new Date().toISOString();
      update(conversationId, (list) =>
        list.map((m) =>
          m.id === id
            ? { ...m, content, editedAt: now, updatedAt: now }
            : m.replyTo?.id === id
              ? { ...m, replyTo: { ...m.replyTo, content } }
              : m,
        ),
      );
    },
    [update],
  );

  const deleteMessage = useCallback(
    (conversationId: string, id: string) => {
      const now = new Date().toISOString();
      update(conversationId, (list) =>
        list.map((m) =>
          m.id === id
            ? { ...m, content: "", reactions: [], replyTo: null, deletedAt: now, updatedAt: now }
            : m.replyTo?.id === id
              ? { ...m, replyTo: { ...m.replyTo, content: "", deleted: true } }
              : m,
        ),
      );
    },
    [update],
  );

  const toggleReaction = useCallback(
    (conversationId: string, messageId: string, emoji: string) => {
      if (!me) return;
      update(conversationId, (list) =>
        list.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          const mine = existing?.userIds.includes(me.id) ?? false;
          const userIds = mine ? existing!.userIds.filter((u) => u !== me.id) : [...(existing?.userIds ?? []), me.id];
          const reactions = existing
            ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds, count: userIds.length } : r)).filter((r) => r.count > 0)
            : [...m.reactions, { emoji, count: 1, userIds: [me.id] }];
          return { ...m, reactions };
        }),
      );
    },
    [me, update],
  );

  // ── Search (local) ────────────────────────────────────────
  const search = useCallback(
    (query: string): ChatSearchResults => {
      const q = query.trim().toLowerCase();
      if (!q) return { people: [], channels: [], messages: [] };
      const people = MOCK_CONTACTS.filter((c) => fullName(c).toLowerCase().includes(q));
      const channels = list.filter((c) => c.kind === "channel" && c.name.toLowerCase().includes(q));
      const found = list.flatMap((conversation) =>
        (messages[conversation.id] ?? [])
          .filter((m) => !m.deletedAt && m.content.toLowerCase().includes(q))
          .map((message) => ({ conversation, message })),
      );
      found.sort((a, b) => (a.message.createdAt < b.message.createdAt ? 1 : -1));
      return { people, channels, messages: found.slice(0, 20) };
    },
    [list, messages],
  );

  return {
    me,
    /** Mock messages are seeded; until then a mock conversation has nothing to show. */
    ready: Object.keys(messages).length > 0,
    conversations: list,
    contacts: MOCK_CONTACTS,
    messages,
    markRead,
    toggleMute,
    createChannel,
    openDirect,
    channelNameTaken,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    search,
  };
}

export type ChatWorkspace = ReturnType<typeof useChatWorkspace>;
