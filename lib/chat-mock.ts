import type { ChatContact, ChatConversation, ChatMessage, ChatUser } from "@/types/chat";

/**
 * Local stand-in for channels and direct messages until their APIs exist.
 *
 * Everything here has the shape the API will return (see types/chat.ts), so
 * replacing it is a data-source change: `hooks/use-chat-workspace.ts` is the
 * only consumer. `# General` is the exception — it is the real Global Chat,
 * served by the API and socket today.
 */

/** The real Global Chat. Its messages come from /api/chat/messages, not from here. */
export const LIVE_CHANNEL_ID = "channel-general";

export const MOCK_CONTACTS: ChatContact[] = [
  { id: "user-1", firstName: "Rahul", lastName: "Sharma", avatarUrl: null, presence: "online" },
  { id: "user-2", firstName: "Priya", lastName: "Patel", avatarUrl: null, presence: "online" },
  { id: "user-3", firstName: "Amit", lastName: "Verma", avatarUrl: null, presence: "offline" },
  { id: "user-4", firstName: "Samir", lastName: "Khan", avatarUrl: null, presence: "online" },
  { id: "user-5", firstName: "Rachit", lastName: "Mehta", avatarUrl: null, presence: "away" },
  { id: "user-6", firstName: "Tarun", lastName: "Joshi", avatarUrl: null, presence: "offline" },
  { id: "user-7", firstName: "Ritik", lastName: "Desai", avatarUrl: null, presence: "online" },
  { id: "user-8", firstName: "Puran", lastName: "Singh", avatarUrl: null, presence: "offline" },
];

export const directConversationId = (contactId: string) => `dm-${contactId}`;

const contact = (id: string) => MOCK_CONTACTS.find((c) => c.id === id)!;
const asUser = ({ presence: _presence, ...user }: ChatContact): ChatUser => user;

/** ISO time `daysAgo` days back at hh:mm local time. */
function at(daysAgo: number, hh: number, mm: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

let seq = 0;
function message(conversationId: string, sender: ChatUser, content: string, createdAt: string, extra: Partial<ChatMessage> = {}): ChatMessage & { conversationId: string } {
  seq += 1;
  return {
    id: `mock-${conversationId}-${seq}`,
    conversationId,
    content,
    sender,
    replyTo: null,
    reactions: [],
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

function channel(id: string, name: string, description: string, visibility: "public" | "private", unread = 0): ChatConversation {
  return { id, kind: "channel", name, description, visibility, contact: null, unread, muted: false, lastMessage: null, live: false };
}

function direct(contactId: string, unread = 0): ChatConversation {
  const c = contact(contactId);
  return {
    id: directConversationId(contactId),
    kind: "direct",
    name: `${c.firstName} ${c.lastName}`,
    description: null,
    visibility: null,
    contact: c,
    unread,
    muted: false,
    lastMessage: null,
    live: false,
  };
}

export const INITIAL_CONVERSATIONS: ChatConversation[] = [
  { ...channel(LIVE_CHANNEL_ID, "General", "Everyone in TimeFlow", "public"), live: true },
  channel("channel-leave", "Leave Monitoring", "Leave requests and approvals", "private"),
  direct("user-1", 2),
  direct("user-2"),
  direct("user-3"),
  direct("user-4", 1),
  direct("user-5"),
];

/**
 * Builds the seed messages for `me`, the signed-in user, so "your" messages in
 * the mock conversations are really attributed to you.
 */
export function buildMockMessages(me: ChatUser): Record<string, ChatMessage[]> {
  const rahul = asUser(contact("user-1"));
  const priya = asUser(contact("user-2"));
  const amit = asUser(contact("user-3"));
  const samir = asUser(contact("user-4"));
  const rachit = asUser(contact("user-5"));

  const all = [
    // # Leave Monitoring
    message("channel-leave", rachit, "Reminder: submit next month's leave plans by Friday.", at(2, 11, 0)),
    message("channel-leave", amit, "Mine is in. Out on the 14th and 15th.", at(2, 11, 26)),
    message("channel-leave", me, "Approved, thanks Amit.", at(1, 10, 2)),

    // DMs
    message("dm-user-1", rahul, "Hey, how are you?", at(1, 19, 2)),
    message("dm-user-1", me, "I'm good! How about you?", at(1, 19, 5)),
    message("dm-user-1", rahul, "Doing great 👍", at(1, 19, 6)),
    message("dm-user-1", rahul, "Do you have a minute to look at the sprint board?", at(0, 10, 11)),
    message("dm-user-1", rahul, "Two tasks look blocked.", at(0, 10, 12)),

    message("dm-user-2", priya, "Has the new task been completed?", at(0, 9, 45)),
    message("dm-user-2", me, "Yes, I completed it. Moving it to review now.", at(0, 9, 47)),

    message("dm-user-3", amit, "Sent you the leave report.", at(4, 17, 30)),

    message("dm-user-4", samir, "Can you add me to the Leave Monitoring channel?", at(0, 8, 58)),

    message("dm-user-5", me, "Thanks for covering the release yesterday!", at(2, 9, 0)),
    message("dm-user-5", rachit, "Anytime 🙌", at(2, 9, 20)),
  ];

  const byConversation: Record<string, ChatMessage[]> = {};
  for (const { conversationId, ...m } of all) (byConversation[conversationId] ??= []).push(m);
  return byConversation;
}
