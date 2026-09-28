import { describe, it, expect } from "vitest";
import {
  LLMResponseSchema,
  CheckRequestSchema,
  countWords,
} from "@/lib/schema";

describe("LLMResponseSchema & CheckRequestSchema Validation", () => {
  it("1. validates a properly formatted LLM response", () => {
    const validData = {
      language: "English",
      correctedText: "They are going to the library today.",
      issues: [
        {
          original: "their",
          suggestion: "they are",
          category: "grammar",
          explanation: "Use they are as the subject and auxiliary verb.",
          context: "their going to the",
        },
      ],
      score: 92,
    };

    const parsed = LLMResponseSchema.parse(validData);
    expect(parsed.language).toBe("English");
    expect(parsed.score).toBe(92);
    expect(parsed.issues).toHaveLength(1);
  });

  it("2. rejects invalid category", () => {
    const invalidCategoryData = {
      language: "English",
      correctedText: "Hello world",
      issues: [
        {
          original: "Hello",
          suggestion: "Hi",
          category: "unsupported_category", // Invalid
          explanation: "Too casual",
          context: "Hello world",
        },
      ],
      score: 85,
    };

    expect(() => LLMResponseSchema.parse(invalidCategoryData)).toThrow();
  });

  it("3. rejects response with missing required fields", () => {
    const missingFieldData = {
      // Missing 'language'
      correctedText: "Some text",
      issues: [],
      score: 100,
    };

    expect(() => LLMResponseSchema.parse(missingFieldData)).toThrow();
  });

  it("4. rejects invalid score (outside 0-100 range)", () => {
    const tooHighScore = {
      language: "English",
      correctedText: "Perfect text.",
      issues: [],
      score: 150, // Invalid: must be <= 100
    };

    const negativeScore = {
      language: "English",
      correctedText: "Bad text.",
      issues: [],
      score: -10, // Invalid: must be >= 0
    };

    expect(() => LLMResponseSchema.parse(tooHighScore)).toThrow();
    expect(() => LLMResponseSchema.parse(negativeScore)).toThrow();
  });

  it("5. rejects explanation exceeding 25 words", () => {
    const longExplanation =
      "This is an extraordinarily verbose explanation that goes on and on far past the twenty-five word limit specified in the application specification to ensure concise output.";

    expect(countWords(longExplanation)).toBeGreaterThan(25);

    const dataWithLongExplanation = {
      language: "English",
      correctedText: "Example text.",
      issues: [
        {
          original: "text",
          suggestion: "passage",
          category: "style",
          explanation: longExplanation,
          context: "Example text.",
        },
      ],
      score: 80,
    };

    expect(() => LLMResponseSchema.parse(dataWithLongExplanation)).toThrow();
  });

  it("6. rejects invalid issue object (e.g. non-string fields)", () => {
    const invalidIssue = {
      language: "English",
      correctedText: "Some text.",
      issues: [
        {
          original: 12345, // Invalid: must be string
          suggestion: "fixed",
          category: "spelling",
          explanation: "Typo error",
          context: "Some text.",
        },
      ],
      score: 90,
    };

    expect(() => LLMResponseSchema.parse(invalidIssue)).toThrow();
  });

  it("7. validates and rejects invalid CheckRequest", () => {
    // Valid request
    const validReq = {
      text: "Please check this sentence.",
      mode: "fix",
    };
    expect(CheckRequestSchema.parse(validReq).text).toBe(validReq.text);

    // Empty text
    expect(() => CheckRequestSchema.parse({ text: "   ", mode: "fix" })).toThrow();

    // Missing text
    expect(() => CheckRequestSchema.parse({ mode: "fix" })).toThrow();

    // Invalid mode
    expect(() =>
      CheckRequestSchema.parse({
        text: "Valid text",
        mode: "alien_mode",
      })
    ).toThrow();

    // Text exceeding 5,000 characters
    const overLimitText = "a".repeat(5001);
    expect(() =>
      CheckRequestSchema.parse({
        text: overLimitText,
        mode: "fix",
      })
    ).toThrow();
  });
});
