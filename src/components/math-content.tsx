"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { FigureCallout, parseGraphSpec } from "@/components/function-graph";

const FunctionGraph = dynamic(
  () => import("@/components/function-graph").then((m) => ({ default: m.FunctionGraph })),
  {
    ssr: false,
    loading: () => (
      <div className="my-4 h-[320px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]" />
    ),
  }
);

type Props = {
  content: string;
  className?: string;
};

function normalizeLatexDelimiters(raw: string): string {
  let s = raw.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `\n$$${inner}$$\n`);
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => `$${inner}$`);
  return s;
}

type ContentPart =
  | { kind: "text"; value: string }
  | { kind: "graph"; value: string }
  | { kind: "figure"; value: string };

function splitContentParts(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const re = /\[(GRAPH|FIGURE)\]([\s\S]*?)\[\/\1\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: content.slice(last, m.index) });
    parts.push({ kind: m[1].toUpperCase() === "GRAPH" ? "graph" : "figure", value: m[2].trim() });
    last = re.lastIndex;
  }
  if (last < content.length) parts.push({ kind: "text", value: content.slice(last) });
  return parts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MD_COMPONENTS: Record<string, (props: any) => React.ReactElement | null> = {
  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => <h2 className="mb-2 mt-5 text-base font-bold text-[var(--foreground)] first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-bold text-[var(--foreground)] first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-[var(--foreground)] first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] first:mt-0">{children}</h5>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--foreground)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--foreground)]">{children}</em>,
  ul: ({ children }) => <ul className="my-2 space-y-1 pl-4 [list-style-type:disc]">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 space-y-1 pl-4 [list-style-type:decimal]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--accent)]/50 pl-4 text-[var(--muted)] italic">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[var(--surface-strong)] p-4 text-xs font-mono leading-relaxed text-[var(--foreground)]">
      {children}
    </pre>
  ),
  code: ({ children, className: cls }: { children?: React.ReactNode; className?: string }) => {
    if (cls?.startsWith("language-")) return <code className={cls}>{children}</code>;
    return (
      <code className="rounded-md bg-[var(--surface-strong)] px-1.5 py-0.5 text-[0.8em] font-mono text-[var(--foreground)]">
        {children}
      </code>
    );
  },
  hr: () => <hr className="my-4 border-[var(--border)]" />,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-[var(--border)]">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[var(--border)]/60 last:border-0">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 leading-relaxed">{children}</td>,
};

export function MathContent({ content, className = "" }: Props) {
  const normalized = normalizeLatexDelimiters(content);
  const parts = splitContentParts(normalized);

  return (
    <div className={`math-content ${className}`.trim()}>
      {parts.map((part, i) => {
        if (part.kind === "graph") {
          const spec = parseGraphSpec(part.value);
          return spec ? <FunctionGraph key={i} spec={spec} /> : null;
        }
        if (part.kind === "figure") {
          return <FigureCallout key={i} description={part.value} />;
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={MD_COMPONENTS}>
            {part.value}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
