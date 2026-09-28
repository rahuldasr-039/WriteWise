"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CheckMode, Issue, LLMResponse, ApiResponse } from "@/lib/schema";
import {
  locateIssues,
  resolveOverlaps,
  applySingleFix,
  applyAllFixes,
  LocatedIssue,
} from "@/lib/locate";
import {
  getHistory,
  saveHistoryItem,
  clearHistory,
  deleteHistoryItem,
  HistoryItem,
} from "@/lib/history";
import { Editor } from "@/components/Editor";
import { HighlightedText } from "@/components/HighlightedText";
import { IssueCard } from "@/components/IssueCard";
import { Summary } from "@/components/Summary";
import { ModeSelect } from "@/components/ModeSelect";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  History,
  Copy,
  Check,
  CheckCheck,
  Sparkles,
  AlertCircle,
  FileCheck2,
  ListFilter,
} from "lucide-react";

const EXAMPLE_TEXT =
  "Their going to the office yesterday to discuss about the project. The manager said that each of the employees need to submit there reports by monday, but no one have completed it yet. Its very important that we finishes this soon.";

export default function HomePage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CheckMode>("fix");
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check result state
  const [checkResult, setCheckResult] = useState<LLMResponse | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Results tab view: "highlight" | "corrected"
  const [activeTab, setActiveTab] = useState<"highlight" | "corrected">("highlight");

  // Category filter for issue cards
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // AbortController ref to cancel in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history from localStorage on client mount
  useEffect(() => {
    setHistoryItems(getHistory());
  }, []);

  // Compute issue positions deterministically derived from canonical text + issues
  const { locatedIssues, unlocatedIssues, activeInlineIssues } = useMemo(() => {
    if (!checkResult || !checkResult.issues || checkResult.issues.length === 0) {
      return {
        locatedIssues: [] as LocatedIssue[],
        unlocatedIssues: [] as Issue[],
        activeInlineIssues: [] as LocatedIssue[],
      };
    }

    const { located, unlocated } = locateIssues(text, checkResult.issues);
    const { active } = resolveOverlaps(located);

    return {
      locatedIssues: located,
      unlocatedIssues: unlocated,
      activeInlineIssues: active,
    };
  }, [text, checkResult]);

  // Filter issues displayed in the right-side cards
  const displayIssues = useMemo(() => {
    if (!checkResult) return [];
    if (selectedCategory === "all") return checkResult.issues;
    return checkResult.issues.filter((i) => i.category === selectedCategory);
  }, [checkResult, selectedCategory]);

  // Abort previous request when user edits text
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsChecking(false);
    }
  }, []);

  // Execute check against server API route
  const handleCheck = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage("Please enter some text to check.");
      return;
    }

    if (text.length > 5000) {
      setErrorMessage("Your text is too long. Maximum 5,000 characters.");
      return;
    }

    // Cancel existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsChecking(true);
    setErrorMessage(null);
    setSelectedIssueId(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
        signal: controller.signal,
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        const errorText = !data.success
          ? data.error.message
          : "Something went wrong while checking your text.";
        setErrorMessage(errorText);
        setIsChecking(false);
        return;
      }

      setCheckResult(data.result);
      setIsChecking(false);

      // Save to client-side localStorage history
      const updated = saveHistoryItem({
        originalText: text,
        correctedText: data.result.correctedText,
        issues: data.result.issues,
        score: data.result.score,
        language: data.result.language,
        mode,
      });
      setHistoryItems(updated);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request cancelled intentionally
        return;
      }
      setErrorMessage("Network error or server unreachable. Please try again.");
      setIsChecking(false);
    }
  };

  // Accept a single issue: replace in source text, recompute state
  const handleAcceptIssue = (targetIssue: Issue) => {
    // Find matching located issue
    const targetLocated = locatedIssues.find((l) => l.issue === targetIssue);

    let nextText = text;
    if (targetLocated) {
      nextText = applySingleFix(text, targetLocated);
    } else {
      // Fallback: direct first occurrence replacement
      const idx = text.indexOf(targetIssue.original);
      if (idx !== -1) {
        nextText =
          text.slice(0, idx) +
          targetIssue.suggestion +
          text.slice(idx + targetIssue.original.length);
      }
    }

    // Update canonical source text
    setText(nextText);

    // Update checkResult with the issue removed
    if (checkResult) {
      const remainingIssues = checkResult.issues.filter((i) => i !== targetIssue);
      setCheckResult({
        ...checkResult,
        issues: remainingIssues,
        // If all issues accepted, score becomes 100
        score: remainingIssues.length === 0 ? 100 : checkResult.score,
      });
    }

    setSelectedIssueId(null);
  };

  // Accept All: replace all active issues safely from right to left
  const handleAcceptAll = () => {
    if (!checkResult || locatedIssues.length === 0) return;

    const nextText = applyAllFixes(text, activeInlineIssues);
    setText(nextText);

    // Filter out active issues that were replaced
    const replacedIssueSet = new Set(activeInlineIssues.map((a) => a.issue));
    const remainingIssues = checkResult.issues.filter(
      (issue) => !replacedIssueSet.has(issue)
    );

    setCheckResult({
      ...checkResult,
      issues: remainingIssues,
      score: remainingIssues.length === 0 ? 100 : checkResult.score,
    });

    setSelectedIssueId(null);
  };

  // Copy corrected text to clipboard
  const handleCopyCorrected = async () => {
    if (!checkResult?.correctedText) return;
    try {
      await navigator.clipboard.writeText(checkResult.correctedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Restore previous check from history
  const handleRestoreHistory = (item: HistoryItem) => {
    setText(item.originalText);
    setMode(item.mode);
    setCheckResult({
      language: item.language,
      correctedText: item.correctedText,
      issues: item.issues,
      score: item.score,
    });
    setErrorMessage(null);
    setSelectedIssueId(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              W
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              WriteWise
            </span>
          </div>

          {/* Mode Selector */}
          <div className="hidden sm:block">
            <ModeSelect
              selectedMode={mode}
              onSelectMode={setMode}
              disabled={isChecking}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Open history drawer"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden md:inline">History</span>
              {historyItems.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {historyItems.length}
                </span>
              )}
            </button>

            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Mode Selector */}
        <div className="sm:hidden px-4 pb-2.5 overflow-x-auto">
          <ModeSelect
            selectedMode={mode}
            onSelectMode={setMode}
            disabled={isChecking}
          />
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 items-start">
          {/* LEFT PANEL: EDITOR */}
          <section className="flex flex-col h-full space-y-4" aria-label="Text Editor">
            <Editor
              text={text}
              onChangeText={handleTextChange}
              onCheck={handleCheck}
              isChecking={isChecking}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage(null)}
              onPopulateExample={() => {
                setText(EXAMPLE_TEXT);
                setErrorMessage(null);
              }}
            />
          </section>

          {/* RIGHT PANEL: RESULTS */}
          <section
            className="flex flex-col h-full space-y-4"
            aria-label="Checking Results"
            aria-live="polite"
          >
            {/* Loading Skeleton */}
            {isChecking && (
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            )}

            {/* Results Display */}
            {!isChecking && checkResult && (
              <div className="space-y-4">
                {/* Summary Score Bar */}
                <Summary
                  score={checkResult.score}
                  issues={checkResult.issues}
                  language={checkResult.language}
                />

                {/* View Tabs & Action Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("highlight")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        activeTab === "highlight"
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      Inline Issues ({checkResult.issues.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("corrected")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                        activeTab === "corrected"
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Corrected text</span>
                    </button>
                  </div>

                  {activeTab === "highlight" && checkResult.issues.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Accept all</span>
                    </button>
                  )}
                </div>

                {/* Tab 1: Inline Highlight & Issue Cards */}
                {activeTab === "highlight" && (
                  <div className="space-y-4">
                    {/* Inline Underlined Text */}
                    <HighlightedText
                      text={text}
                      activeIssues={activeInlineIssues}
                      selectedIssueId={selectedIssueId}
                      onSelectIssue={(id) => setSelectedIssueId(id)}
                    />

                    {/* Zero Issues State */}
                    {checkResult.issues.length === 0 && (
                      <div className="p-6 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-center space-y-1.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                        <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-200">
                          Flawless text! Zero issues found.
                        </h3>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          Your writing adheres cleanly to standard grammar, orthography, and the
                          selected mode.
                        </p>
                      </div>
                    )}

                    {/* Category Filter Pills (if issues exist) */}
                    {checkResult.issues.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                        <span className="text-slate-400 mr-1 flex items-center gap-1">
                          <ListFilter className="w-3 h-3" /> Filter:
                        </span>
                        {["all", "spelling", "grammar", "punctuation", "style"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-2 py-0.5 rounded capitalize ${
                              selectedCategory === cat
                                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Issue Cards Stack */}
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {displayIssues.map((issue, idx) => {
                        const located = locatedIssues.find((l) => l.issue === issue);
                        const isSelected = Boolean(located && located.id === selectedIssueId);

                        return (
                          <IssueCard
                            key={`card-${idx}-${issue.original}-${issue.category}`}
                            issue={issue}
                            isSelected={isSelected}
                            onSelect={() => {
                              if (located) setSelectedIssueId(located.id);
                            }}
                            onAccept={() => handleAcceptIssue(issue)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab 2: Corrected Text View */}
                {activeTab === "corrected" && (
                  <div className="space-y-3">
                    <div className="relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-sans leading-relaxed whitespace-pre-wrap break-words">
                      {checkResult.correctedText}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleCopyCorrected}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                        aria-label="Copy corrected text"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Copied
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy corrected text</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State before any check has run */}
            {!isChecking && !checkResult && (
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 h-full min-h-[320px]">
                <Sparkles className="w-8 h-8 stroke-1 mb-2 text-blue-500 opacity-60" />
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  Ready to check your writing
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Type or paste your text on the left and click &quot;Check&quot; (or press Ctrl+Enter).
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* PRIVACY FOOTER (Section 33) */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-4 px-4 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>
          Your text is sent to the selected LLM provider for checking and is not stored on our server.
        </p>
      </footer>

      {/* HISTORY DRAWER (Section 23) */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyItems}
        onSelectHistoryItem={handleRestoreHistory}
        onClearHistory={() => {
          clearHistory();
          setHistoryItems([]);
        }}
        onDeleteHistoryItem={(id) => {
          const updated = deleteHistoryItem(id);
          setHistoryItems(updated);
        }}
      />
    </div>
  );
}
