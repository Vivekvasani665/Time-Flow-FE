"use client";

import { Hash, Lock, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { ChatSearchResults as Results } from "@/hooks/use-chat-workspace";
import { fullName } from "@/lib/utils";
import type { ChatContact } from "@/types/chat";
import { PresenceDot } from "./presence-dot";

type ChatSearchResultsProps = {
  query: string;
  results: Results;
  onOpenPerson: (contact: ChatContact) => void;
  onOpenConversation: (id: string, messageId?: string) => void;
};

/** Case-insensitive highlight of the query inside a snippet. Plain text only. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0 || !query) return <>{text}</>;
  // Start a long snippet near the match so it's visible.
  const start = at > 40 ? at - 30 : 0;
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, at)}
      <mark className="rounded-sm bg-amber/25 px-0.5 text-ink">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className="eyebrow px-2">{title}</h3>
      <ul className="mt-1 space-y-px">{children}</ul>
    </section>
  );
}

const row = "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-ink-dim hover:bg-panel-3 hover:text-ink";

export function ChatSearchResults({ query, results, onOpenPerson, onOpenConversation }: ChatSearchResultsProps) {
  const q = query.trim();
  const total = results.people.length + results.channels.length + results.messages.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center" role="status">
        <SearchX className="size-5 text-ink-mute" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">No results for “{q}”</p>
        <p className="text-xs text-ink-mute">Try a name, a channel, or words from a message.</p>
      </div>
    );
  }

  return (
    <div role="region" aria-label={`Search results for ${q}`}>
      <p className="sr-only" role="status">
        {total} results
      </p>
      {results.people.length > 0 && (
        <Group title="People">
          {results.people.map((c) => (
            <li key={c.id}>
              <button type="button" className={row} onClick={() => onOpenPerson(c)}>
                <span className="relative shrink-0">
                  <Avatar user={c} size="xs" />
                  <PresenceDot presence={c.presence} className="absolute -right-0.5 -bottom-0.5 size-2" />
                </span>
                <span className="truncate">
                  <Highlight text={fullName(c)} query={q} />
                </span>
              </button>
            </li>
          ))}
        </Group>
      )}
      {results.channels.length > 0 && (
        <Group title="Channels">
          {results.channels.map((c) => {
            const Icon = c.visibility === "private" ? Lock : Hash;
            return (
              <li key={c.id}>
                <button type="button" className={row} onClick={() => onOpenConversation(c.id)}>
                  <Icon className="size-4 shrink-0 text-ink-mute" aria-hidden="true" />
                  <span className="truncate">
                    <Highlight text={c.name} query={q} />
                  </span>
                </button>
              </li>
            );
          })}
        </Group>
      )}
      {results.messages.length > 0 && (
        <Group title="Messages">
          {results.messages.map(({ conversation, message }) => (
            <li key={message.id}>
              <button type="button" className={`${row} items-start`} onClick={() => onOpenConversation(conversation.id, message.id)}>
                <Avatar user={message.sender} size="xs" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5 text-xs">
                    <span className="truncate font-semibold text-ink">{message.sender.firstName}</span>
                    <span className="truncate text-ink-mute">
                      in {conversation.kind === "channel" ? `#${conversation.name}` : conversation.name}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-xs">
                    <Highlight text={message.content} query={q} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </Group>
      )}
    </div>
  );
}
