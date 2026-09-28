import { describe, it, expect } from "vitest";
import {
  locateIssues,
  resolveOverlaps,
  applySingleFix,
  applyAllFixes,
  buildTextSegments,
} from "@/lib/locate";
import { Issue } from "@/lib/schema";

describe("locateIssues", () => {
  it("1. handles duplicate substrings across distinct positions", () => {
    const text = "He went their yesterday because their team was there.";
    const issues: Issue[] = [
      {
        original: "their",
        suggestion: "there",
        category: "spelling",
        explanation: "Wrong homophone.",
        context: "He went their yesterday",
      },
      {
        original: "their",
        suggestion: "the",
        category: "style",
        explanation: "Unnecessary pronoun.",
        context: "because their team was",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);

    expect(unlocated).toHaveLength(0);
    expect(located).toHaveLength(2);
    // First 'their' is at index 8, second 'their' is at index 32
    expect(located[0].start).toBe(8);
    expect(located[1].start).toBe(32);
    expect(located[0].start).not.toBe(located[1].start);
  });

  it("2. handles punctuation and contractions correctly", () => {
    const text = "Its raining, but the dog chased its tail.";
    const issues: Issue[] = [
      {
        original: "Its",
        suggestion: "It's",
        category: "punctuation",
        explanation: "Contraction of it is requires an apostrophe.",
        context: "Its raining, but",
      },
      {
        original: "raining,",
        suggestion: "raining;",
        category: "punctuation",
        explanation: "Semicolon needed.",
        context: "raining, but the",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);

    expect(unlocated).toHaveLength(0);
    expect(located).toHaveLength(2);
    expect(located[0].start).toBe(0);
    expect(located[0].end).toBe(3);
    expect(located[1].start).toBe(4);
    expect(located[1].end).toBe(12);
  });

  it("3. handles unicode, accents, and emoji characters correctly", () => {
    const text = "We visited the café ☕ and bought baguettes.";
    const issues: Issue[] = [
      {
        original: "café",
        suggestion: "bistro",
        category: "style",
        explanation: "Alternative phrasing.",
        context: "visited the café ☕ and",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);

    expect(unlocated).toHaveLength(0);
    expect(located).toHaveLength(1);
    expect(text.slice(located[0].start, located[0].end)).toBe("café");
  });

  it("4. handles repeated phrases without duplicate offset assignment", () => {
    const text = "as soon as possible, we must reply as soon as possible.";
    const issues: Issue[] = [
      {
        original: "as soon as possible",
        suggestion: "ASAP",
        category: "style",
        explanation: "More concise.",
        context: "as soon as possible, we",
      },
      {
        original: "as soon as possible",
        suggestion: "promptly",
        category: "style",
        explanation: "Avoid repetition.",
        context: "reply as soon as possible.",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);

    expect(unlocated).toHaveLength(0);
    expect(located).toHaveLength(2);
    expect(located[0].start).toBe(0);
    expect(located[1].start).toBe(35);
  });

  it("5. safely separates overlapping issues into active and overlapping sets", () => {
    const text = "He should of gone home.";
    // Overlapping issues: "should of" [3, 12] and "of gone" [10, 17]
    const located = [
      {
        id: "issue-1",
        issue: {
          original: "should of",
          suggestion: "should have",
          category: "grammar" as const,
          explanation: "Use have instead of of.",
          context: "He should of gone",
        },
        start: 3,
        end: 12,
      },
      {
        id: "issue-2",
        issue: {
          original: "of gone",
          suggestion: "have gone",
          category: "grammar" as const,
          explanation: "Modal verb auxiliary.",
          context: "should of gone home",
        },
        start: 10,
        end: 17,
      },
    ];

    const { active, overlapping } = resolveOverlaps(located);

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("issue-1");
    expect(overlapping).toHaveLength(1);
    expect(overlapping[0].id).toBe("issue-2");
  });

  it("6. drops unlocated issues gracefully without crashing", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const issues: Issue[] = [
      {
        original: "nonexistent text",
        suggestion: "something",
        category: "spelling",
        explanation: "This does not exist in source.",
        context: "somewhere else",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);

    expect(located).toHaveLength(0);
    expect(unlocated).toHaveLength(1);
    expect(unlocated[0].original).toBe("nonexistent text");
  });

  it("7. disambiguates identical words using surrounding context", () => {
    const text = "We walked along the river bank before visiting the savings bank.";
    const issues: Issue[] = [
      {
        original: "bank",
        suggestion: "shore",
        category: "style",
        explanation: "More descriptive for a natural waterway.",
        context: "along the river bank before",
      },
    ];

    const { located } = locateIssues(text, issues);

    expect(located).toHaveLength(1);
    // River bank is around index 26, savings bank is around index 59
    expect(located[0].start).toBe(26);
    expect(text.slice(located[0].start, located[0].end)).toBe("bank");
  });
});

describe("applyAllFixes & applySingleFix", () => {
  it("applies multiple fixes safely from right to left", () => {
    const text = "their going to there house";
    const issues: Issue[] = [
      {
        original: "their",
        suggestion: "they're",
        category: "grammar",
        explanation: "Contraction.",
        context: "their going to",
      },
      {
        original: "there",
        suggestion: "their",
        category: "grammar",
        explanation: "Possessive pronoun.",
        context: "to there house",
      },
    ];

    const { located } = locateIssues(text, issues);
    const { active } = resolveOverlaps(located);
    const result = applyAllFixes(text, active);

    expect(result).toBe("they're going to their house");
  });

  it("applies a single fix correctly", () => {
    const text = "She don't know.";
    const target = {
      id: "test-1",
      issue: {
        original: "don't",
        suggestion: "doesn't",
        category: "grammar" as const,
        explanation: "Subject-verb agreement.",
        context: "She don't know.",
      },
      start: 4,
      end: 9,
    };

    const result = applySingleFix(text, target);
    expect(result).toBe("She doesn't know.");
  });

  it("builds non-overlapping text segments covering entire string", () => {
    const text = "Good morning, friend.";
    const active = [
      {
        id: "test-seg",
        issue: {
          original: "friend",
          suggestion: "colleague",
          category: "style" as const,
          explanation: "Formal tone.",
          context: "morning, friend.",
        },
        start: 14,
        end: 20,
      },
    ];

    const segments = buildTextSegments(text, active);
    const reconstructed = segments.map((s) => s.text).join("");
    expect(reconstructed).toBe(text);
  });
});
