"use client";

import { useEffect, useRef } from "react";
import { countWords } from "@/lib/schema";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";

interface EditorProps {
  text: string;
  onChangeText: (text: string) => void;
  onCheck: () => void;
  isChecking: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  onPopulateExample: () => void;
}

const MAX_CHARS = 5000;

export function Editor({
  text,
  onChangeText,
  onCheck,
  isChecking,
  errorMessage,
  onClearError,
  onPopulateExample,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const words = countWords(text);
  const isOverLimit = charCount > MAX_CHARS;

  // Handle Ctrl+Enter or Cmd+Enter from textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isChecking && !isOverLimit) {
        onCheck();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (errorMessage) onClearError();
    // Enforce 5,000 character limit client-side
    const nextVal = e.target.value;
    if (nextVal.length <= MAX_CHARS) {
      onChangeText(nextVal);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
        <label
          htmlFor="editor-input"
          className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
        >
          <span>Input text</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
            (Ctrl+Enter to check)
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPopulateExample}
            disabled={isChecking}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try an example</span>
          </button>

          {text.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangeText("");
                if (errorMessage) onClearError();
              }}
              disabled={isChecking}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Clear input text"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 p-3">
        <textarea
          id="editor-input"
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type or paste your text here to check grammar, spelling, punctuation, and style..."
          rows={12}
          aria-invalid={isOverLimit || Boolean(errorMessage)}
          aria-describedby="editor-counter editor-error"
          className="w-full h-full min-h-[220px] p-2 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none font-sans leading-relaxed"
        />
      </div>

      {errorMessage && (
        <div
          id="editor-error"
          role="alert"
          className="mx-3 mb-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      <div
        id="editor-counter"
        className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400"
      >
        <div className="flex items-center gap-3">
          <span className={isOverLimit ? "text-rose-600 font-semibold" : ""}>
            Characters: {charCount} / {MAX_CHARS}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Words: {words}</span>
        </div>

        <button
          type="button"
          onClick={onCheck}
          disabled={isChecking || isOverLimit}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isChecking || isOverLimit
              ? "bg-blue-400 dark:bg-blue-600/50 cursor-not-allowed opacity-70"
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isChecking ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <span>Check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
