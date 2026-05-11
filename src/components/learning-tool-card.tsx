import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type LearningToolCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  label?: string;
};

export function LearningToolCard({ title, description, href, icon: Icon, label }: LearningToolCardProps) {
  return (
    <Link
      href={href}
      className="ai-card group block rounded-[1.5rem] p-5 transition hover:border-[var(--accent)] hover:bg-[var(--paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      <div className="flex items-start justify-between gap-4">
        <Icon className="h-7 w-7 text-[var(--accent)]" aria-hidden />
        <ArrowRight className="h-5 w-5 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--accent)]" aria-hidden />
      </div>
      {label ? <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p> : null}
      <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
