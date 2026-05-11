"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { postTutorChat, type TutorChatMessage } from "@/lib/api";

type ThreadMessage = TutorChatMessage & { _id: number };

type TutorChatPanelProps = {
  paperId: string;
  questionId: string;
  tutorChatEnabled: boolean;
};

export function TutorChatPanel({ paperId, questionId, tutorChatEnabled }: TutorChatPanelProps) {
  const labelId = useId();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [questionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending || !tutorChatEnabled) return;

    const userMsg: ThreadMessage = { role: "user", content: text, _id: msgIdRef.current++ };
    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const apiMessages = nextThread.map(({ role, content }) => ({ role, content }));
      const { reply } = await postTutorChat(paperId, questionId, apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, _id: msgIdRef.current++ }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setPending(false);
    }
  }, [input, messages, paperId, pending, questionId, tutorChatEnabled]);

  return (
    <section
      className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 shadow-sm sm:p-5"
      aria-labelledby={labelId}
    >
      <h3 id={labelId} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
        <MessageCircle className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        Tutor chat
      </h3>

      {!tutorChatEnabled ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Conversational tutoring is turned off on the server. Enable{" "}
          <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5 text-[var(--foreground)]">MatricPrep:TutorChat:Enabled</code>{" "}
          and configure OpenAI (set{" "}
          <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5 text-[var(--foreground)]">OPENAI_API_KEY</code>{" "}
          or{" "}
          <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5 text-[var(--foreground)]">MatricPrep:TutorChat:OpenAiApiKey</code>
          ) if you want to ask follow-up questions here.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ask for a step-by-step path to the memo answer, or clarify the wording of the question.
          </p>

          <div className="mt-4 min-h-[220px] max-h-[min(420px,52vh)] flex-1 space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3">
            {messages.length === 0 && !pending ? (
              <p className="text-sm text-[var(--muted)]">Your conversation for this question will appear here.</p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m._id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                  }`}
                >
                  <span className="sr-only">{m.role === "user" ? "You: " : "Tutor: "}</span>
                  <span className="whitespace-pre-wrap break-words">{m.content}</span>
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <label htmlFor={`${labelId}-input`} className="sr-only">
              Message to tutor
            </label>
            <textarea
              id={`${labelId}-input`}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask the tutor…"
              disabled={pending}
              className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={pending || !input.trim()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-end rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send
            </button>
          </div>
        </>
      )}
    </section>
  );
}
