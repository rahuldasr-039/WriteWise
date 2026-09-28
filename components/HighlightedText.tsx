"use client";

import { LocatedIssue, buildTextSegments } from "@/lib/locate";

interface HighlightedTextProps {
  text: string;
  activeIssues: LocatedIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string) => void;
}

export function HighlightedText({
  text,
  activeIssues,
  selectedIssueId,
  onSelectIssue,
}: HighlightedTextProps) {
  const segments = buildTextSegments(text, activeIssues);

  const getCategoryUnderlineClass = (category: string) => {
    switch (category) {
      case "spelling":
        return "issue-underline-spelling text-red-700 dark:text-red-400 bg-red-50/70 dark:bg-red-950/30";
      case "grammar":
        return "issue-underline-grammar text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30";
      case "punctuation":
        return "issue-underline-punctuation text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30";
      case "style":
        return "issue-underline-style text-purple-700 dark:text-purple-400 bg-purple-50/70 dark:bg-purple-950/30";
      default:
        return "issue-underline-grammar text-blue-700 dark:text-blue-400";
    }
  };

  return (
    <div
      className="w-full min-h-[160px] p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-text"
      aria-label="Checked text with highlighted issues"
    >
      {segments.map((segment) => {
        if (segment.type === "text") {
          return <span key={segment.key}>{segment.text}</span>;
        }

        const { locatedIssue } = segment;
        const isSelected = selectedIssueId === locatedIssue.id;
        const catClass = getCategoryUnderlineClass(locatedIssue.issue.category);

        return (
          <button
            key={segment.key}
            type="button"
            onClick={() => onSelectIssue(locatedIssue.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectIssue(locatedIssue.id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${locatedIssue.issue.category} issue: "${locatedIssue.issue.original}". Suggestion: "${locatedIssue.issue.suggestion}". Press Enter to view.`}
            className={`inline cursor-pointer px-0.5 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${catClass} ${
              isSelected ? "ring-2 ring-blue-500 font-semibold" : ""
            }`}
          >
            {segment.text}
          </button>
        );
      })}
    </div>
  );
}
