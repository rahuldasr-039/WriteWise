import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/check/route";
import { NextRequest } from "next/server";

describe("API Route: /api/check", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.LLM_PROVIDER = "gemini";
  });

  it("rejects empty text with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ text: "", mode: "fix" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toContain("Please enter some text to check.");
  });

  it("rejects whitespace-only text with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.2" },
      body: JSON.stringify({ text: "    ", mode: "fix" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects text longer than 5000 characters with 400", async () => {
    const longText = "a".repeat(5001);
    const req = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.3" },
      body: JSON.stringify({ text: longText, mode: "fix" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toContain("5,000 characters");
  });

  it("rejects invalid JSON with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.4" },
      body: "invalid-json-payload",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_JSON");
  });

  it("returns user-friendly error when LLM_API_KEY is missing", async () => {
    delete process.env.LLM_API_KEY;

    const req = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.5" },
      body: JSON.stringify({ text: "Valid sentence to check.", mode: "fix" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("CONFIG_ERROR");
    expect(json.error.message).toContain("Gemini API key is not configured on the server");
  });

  it("enforces in-memory rate limiting after 20 requests per IP", async () => {
    const ip = "192.168.1.100";
    let lastRes: Response | null = null;

    // Send 20 requests
    for (let i = 0; i < 20; i++) {
      const req = new NextRequest("http://localhost:3000/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ text: "", mode: "fix" }), // triggers rate limiter first
      });
      lastRes = await POST(req);
    }

    // 21st request should be rate-limited
    const blockedReq = new NextRequest("http://localhost:3000/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ text: "hello", mode: "fix" }),
    });
    const blockedRes = await POST(blockedReq);
    const blockedJson = await blockedRes.json();

    expect(blockedRes.status).toBe(429);
    expect(blockedJson.error.code).toBe("RATE_LIMITED");
  });
});
