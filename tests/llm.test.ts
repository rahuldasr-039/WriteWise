import { describe, it, expect } from "vitest";
import { isNonRetryableError } from "@/lib/llm";

describe("isNonRetryableError classification", () => {
  it("detects numeric HTTP status codes 429, 401, 402, 403", () => {
    expect(isNonRetryableError({ status: 429 })).toBe(true);
    expect(isNonRetryableError({ status: 401 })).toBe(true);
    expect(isNonRetryableError({ status: 402 })).toBe(true);
    expect(isNonRetryableError({ status: 403 })).toBe(true);
    expect(isNonRetryableError({ status: 500 })).toBe(false);
  });

  it("detects error codes (numeric and string)", () => {
    expect(isNonRetryableError({ code: 429 })).toBe(true);
    expect(isNonRetryableError({ code: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(isNonRetryableError({ code: "rate_limit_exceeded" })).toBe(true);
    expect(isNonRetryableError({ code: 401 })).toBe(true);
    expect(isNonRetryableError({ code: "VALIDATION_ERROR" })).toBe(false);
  });

  it("detects message indicators", () => {
    expect(isNonRetryableError(new Error("Gemini API rate limit exceeded"))).toBe(true);
    expect(isNonRetryableError(new Error("Resource exhausted: quota exceeded"))).toBe(true);
    expect(isNonRetryableError(new Error("HTTP 429 Too Many Requests"))).toBe(true);
    expect(isNonRetryableError(new Error("RESOURCE_EXHAUSTED: Please wait"))).toBe(true);
    expect(isNonRetryableError(new Error("Invalid API key provided"))).toBe(true);
    expect(isNonRetryableError(new Error("Unexpected token '}'"))).toBe(false);
    expect(isNonRetryableError(new Error("Zod validation failed"))).toBe(false);
  });

  it("detects errorDetails properties", () => {
    expect(isNonRetryableError({ errorDetails: "Quota exceeded for project" })).toBe(true);
    expect(isNonRetryableError({ errorDetails: [{ reason: "RATE_LIMIT_EXCEEDED" }] })).toBe(true);
  });
});
