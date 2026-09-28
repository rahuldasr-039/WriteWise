import { describe, it, expect } from "vitest";
import { locateIssues, applyAllFixes, buildTextSegments } from "@/lib/locate";
import { CheckRequestSchema, LLMResponseSchema, Issue } from "@/lib/schema";

describe("Test Cases (1 to 12) from Requirements", () => {
  it("Case 1: Correct sentence ('I am going to college today.') has zero issues and score 100", () => {
    const text = "I am going to college today.";
    const response = {
      language: "English",
      correctedText: text,
      issues: [],
      score: 100,
    };
    const parsed = LLMResponseSchema.parse(response);
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.score).toBe(100);

    const { located, unlocated } = locateIssues(text, parsed.issues);
    expect(located).toHaveLength(0);
    expect(unlocated).toHaveLength(0);
  });

  it("Case 2: Spelling ('I recieve many mesages.') locates and corrects typos", () => {
    const text = "I recieve many mesages.";
    const issues: Issue[] = [
      {
        original: "recieve",
        suggestion: "receive",
        category: "spelling",
        explanation: "i before e except after c",
        context: "I recieve many",
      },
      {
        original: "mesages",
        suggestion: "messages",
        category: "spelling",
        explanation: "Double 's' in messages",
        context: "many mesages.",
      },
    ];

    const { located, unlocated } = locateIssues(text, issues);
    expect(unlocated).toHaveLength(0);
    expect(located).toHaveLength(2);

    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("I receive many messages.");
  });

  it("Case 3: Grammar ('He go to college every day.') locates and fixes subject-verb agreement", () => {
    const text = "He go to college every day.";
    const issues: Issue[] = [
      {
        original: "go",
        suggestion: "goes",
        category: "grammar",
        explanation: "Third-person singular agreement",
        context: "He go to college",
      },
    ];

    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(1);

    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("He goes to college every day.");
  });

  it("Case 4: Punctuation ('Hello how are you') identifies missing punctuation", () => {
    const text = "Hello how are you";
    const issues: Issue[] = [
      {
        original: "Hello",
        suggestion: "Hello,",
        category: "punctuation",
        explanation: "Comma after greeting",
        context: "Hello how are",
      },
      {
        original: "you",
        suggestion: "you?",
        category: "punctuation",
        explanation: "Question mark at end",
        context: "how are you",
      },
    ];

    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(2);

    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("Hello, how are you?");
  });

  it("Case 5: Style (A long unnecessarily complicated sentence) refines phrasing", () => {
    const text = "In view of the fact that the meeting was postponed, we refrained from action.";
    const issues: Issue[] = [
      {
        original: "In view of the fact that",
        suggestion: "Because",
        category: "style",
        explanation: "More concise phrasing",
        context: "In view of the fact that the",
      },
    ];

    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(1);

    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("Because the meeting was postponed, we refrained from action.");
  });

  it("Case 6: Mixed grammar + spelling + punctuation", () => {
    const text = "she dont like apples and banannas";
    const issues: Issue[] = [
      {
        original: "she dont",
        suggestion: "She doesn't",
        category: "grammar",
        explanation: "Capitalize and fix contraction",
        context: "she dont like",
      },
      {
        original: "banannas",
        suggestion: "bananas.",
        category: "spelling",
        explanation: "Fix spelling and add period",
        context: "and banannas",
      },
    ];

    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(2);
    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("She doesn't like apples and bananas.");
  });

  it("Case 7: Empty input is rejected by CheckRequestSchema", () => {
    expect(() => CheckRequestSchema.parse({ text: "", mode: "fix" })).toThrow();
    expect(() => CheckRequestSchema.parse({ text: "   ", mode: "fix" })).toThrow();
  });

  it("Case 8: More than 5000 characters is rejected by CheckRequestSchema", () => {
    const text = "x".repeat(5001);
    expect(() => CheckRequestSchema.parse({ text, mode: "fix" })).toThrow();
  });

  it("Case 9: Code snippet preservation", () => {
    const text = "Run const x = 10; in your console.";
    const segments = buildTextSegments(text, []);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("Case 10: URL preservation", () => {
    const text = "Visit https://example.com/api/v1 for documentation.";
    const segments = buildTextSegments(text, []);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("Case 11: Non-English text handling", () => {
    const text = "Bonjour mon ami, comment allez vous";
    const issues: Issue[] = [
      {
        original: "allez vous",
        suggestion: "allez-vous ?",
        category: "punctuation",
        explanation: "Hyphen and question mark in French",
        context: "comment allez vous",
      },
    ];
    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(1);
    const fixed = applyAllFixes(text, located);
    expect(fixed).toBe("Bonjour mon ami, comment allez-vous ?");
  });

  it("Case 12: Text containing repeated words disambiguated correctly", () => {
    const text = "They had had dinner before they had coffee.";
    const issues: Issue[] = [
      {
        original: "had",
        suggestion: "consumed",
        category: "style",
        explanation: "Avoid repetitive verb",
        context: "before they had coffee.",
      },
    ];
    const { located } = locateIssues(text, issues);
    expect(located).toHaveLength(1);
    // Third "had" is before "coffee", at index 32
    expect(located[0].start).toBe(32);
    expect(text.slice(located[0].start, located[0].end)).toBe("had");
  });
});
