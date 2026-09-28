import { CheckMode, Issue } from "./schema";

export interface HistoryItem {
  id: string;
  originalText: string;
  correctedText: string;
  issues: Issue[];
  score: number;
  language: string;
  mode: CheckMode;
  timestamp: number;
}

const STORAGE_KEY = "writewise_history_v1";
const MAX_HISTORY_ITEMS = 20;

/**
 * Safely retrieve history list from browser localStorage.
 * Resilient against SSR, corrupted JSON, and storage access errors.
 */
export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter valid history items
    return parsed.filter(
      (item): item is HistoryItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.originalText === "string" &&
        typeof item.correctedText === "string" &&
        Array.isArray(item.issues) &&
        typeof item.score === "number" &&
        typeof item.timestamp === "number"
    );
  } catch {
    // If JSON is malformed or localStorage threw a security error, return empty
    return [];
  }
}

/**
 * Add a new check record to history (newest first, capped at 20).
 */
export function saveHistoryItem(
  entry: Omit<HistoryItem, "id" | "timestamp">
): HistoryItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const current = getHistory();
    const newItem: HistoryItem = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    const updated = [newItem, ...current].slice(0, MAX_HISTORY_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Remove an individual history entry by id.
 */
export function deleteHistoryItem(id: string): HistoryItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const current = getHistory();
    const updated = current.filter((item) => item.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Remove all stored history entries.
 */
export function clearHistory(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
