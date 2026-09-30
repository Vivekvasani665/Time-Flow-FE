"use client";

import { Check, Copy } from "lucide-react";
import { memo, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

function CodeBlock({ language, code }: { language: string | null; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Couldn't copy the code"));

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1 text-xs text-ink-mute">
        <span>{language ?? "code"}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 hover:text-ink" aria-label="Copy code">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[0.8125rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Only http(s) and mailto links become anchors; anything else (e.g. `javascript:`) is dropped.
const safeUrl = (url: string) => (/^(https?:|mailto:)/i.test(url) ? url : "");

const components: Components = {
  // Fenced blocks arrive as <pre><code>; the block is drawn here, inline code below.
  pre: ({ children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const props = (child as { props?: ComponentProps<"code"> } | undefined)?.props;
    const language = /language-(\S+)/.exec(props?.className ?? "")?.[1] ?? null;
    return <CodeBlock language={language} code={String(props?.children ?? "").replace(/\n$/, "")} />;
  },
  code: ({ children }) => <code className="rounded bg-panel px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan underline underline-offset-2 break-all">
      {children}
    </a>
  ),
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-lg font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 mb-1 font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-cyan/50 pl-3 text-ink-dim">{children}</blockquote>,
  hr: () => <hr className="my-3 border-line" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line bg-panel px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1 align-top">{children}</td>,
  img: () => null,
};

/** An assistant reply as Markdown. Raw HTML in the text is never rendered. */
export const AssistantMarkdown = memo(function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="break-words [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={safeUrl}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
