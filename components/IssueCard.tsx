"use client";

import { Issue, IssueCategory } from "@/lib/schema";
import { Check, X } from "lucide-react";

interface IssueCardProps {
  issue: Issue;
  isSelected?: boolean;
  onSelect?: () => void;
  onAccept: () => void;
  onDismiss?: () => void;
}

const CATEGORY_STYLES: Record<
  IssueCategory,
  { label: string; badge: string; border: string }
> = {
  spelling: {
    label: "Spelling",
    badge: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-900",
    border: "hover:border-red-300 dark:hover:border-red-800",
  },
  grammar: {
    label: "Grammar",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900",
    border: "hover:border-blue-300 dark:hover:border-blue-800",
  },
  punctuation: {
    label: "Punctuation",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    border: "hover:border-amber-300 dark:hover:border-amber-800",
  },
  style: {
    label: "Style",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
    border: "hover:border-purple-300 dark:hover:border-purple-800",
  },
};

export function IssueCard({
  issue,
  isSelected = false,
  onSelect,
  onAccept,
  onDismiss,
}: IssueCardProps) {
  const meta = CATEGORY_STYLES[issue.category] || CATEGORY_STYLES.grammar;

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border text-left transition-all ${
        isSelected
          ? "bg-blue-50/60 dark:bg-slate-800/80 border-blue-500 dark:border-blue-500 shadow-sm ring-1 ring-blue-500"
          : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${meta.border}`
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.badge}`}
        >
          {meta.label}
        </span>

        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Dismiss issue"
            aria-label="Dismiss issue"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5 mb-2.5 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="text-slate-400 dark:text-slate-500 font-medium w-14 shrink-0">
            Original:
          </span>
          <span className="line-through text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/30 px-1 py-0.5 rounded">
            {issue.original}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-slate-400 dark:text-slate-500 font-medium w-14 shrink-0">
            Suggested:
          </span>
          <span className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded">
            {issue.suggestion || "(remove)"}
          </span>
        </div>

        {issue.explanation && (
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed pt-1">
            {issue.explanation}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Accept</span>
        </button>
      </div>
    </div>
  );
}
