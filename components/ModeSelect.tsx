"use client";

import { CheckMode } from "@/lib/schema";

interface ModeSelectProps {
  selectedMode: CheckMode;
  onSelectMode: (mode: CheckMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ id: CheckMode; label: string; tooltip: string }> = [
  { id: "fix", label: "Fix errors only", tooltip: "Only fix genuine grammar, spelling, and punctuation errors" },
  { id: "clarity", label: "Improve clarity", tooltip: "Fix errors and clarify awkward or confusing wording" },
  { id: "formal", label: "Formal", tooltip: "Fix errors and elevate to a professional register" },
  { id: "casual", label: "Casual", tooltip: "Fix errors while keeping a conversational, relaxed tone" },
  { id: "concise", label: "Concise", tooltip: "Fix errors and remove unnecessary fluff or wordiness" },
];

export function ModeSelect({ selectedMode, onSelectMode, disabled = false }: ModeSelectProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Checking mode"
      className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium"
    >
      {MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelectMode(mode.id)}
            title={mode.tooltip}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap select-none ${
              isSelected
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-sm border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
