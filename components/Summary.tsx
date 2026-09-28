"use client";

import { Issue } from "@/lib/schema";

interface SummaryProps {
  score: number;
  issues: Issue[];
  language?: string;
}

export function Summary({ score, issues, language }: SummaryProps) {
  const counts = {
    spelling: issues.filter((i) => i.category === "spelling").length,
    grammar: issues.filter((i) => i.category === "grammar").length,
    punctuation: issues.filter((i) => i.category === "punctuation").length,
    style: issues.filter((i) => i.category === "style").length,
  };

  const getScoreBadgeColor = (s: number) => {
    if (s >= 90) return "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    if (s >= 75) return "text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (s >= 60) return "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    return "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800";
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <div className="flex items-center gap-3">
        <div
          className={`flex items-baseline gap-1 px-3 py-1.5 rounded-lg border font-semibold text-sm ${getScoreBadgeColor(
            score
          )}`}
          aria-label={`Score: ${score} out of 100`}
        >
          <span className="text-lg font-bold">{score}</span>
          <span className="text-xs opacity-75">/ 100</span>
        </div>

        {language && (
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-medium">
            Language: {language}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>Spelling: {counts.spelling}</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Grammar: {counts.grammar}</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Punctuation: {counts.punctuation}</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Style: {counts.style}</span>
        </span>
      </div>
    </div>
  );
}
