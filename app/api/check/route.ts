import { NextRequest, NextResponse } from "next/server";
import { CheckRequestSchema, ApiResponse } from "@/lib/schema";
import { runCheck } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  // 1. In-memory Rate Limiting (20 requests per minute per IP)
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many checks. Please wait a moment and try again.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.reset),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 2. Parse & Validate JSON payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Malformed request payload.",
        },
      },
      { status: 400 }
    );
  }

  const validation = CheckRequestSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || "Invalid input parameters.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
      },
      { status: 400 }
    );
  }

  const { text, mode } = validation.data;

  // 3. Setup timeout controller (25 seconds internal timeout before Vercel 30s limit)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 25000);

  try {
    // 4. Call LLM provider abstraction
    const result = await runCheck(text, {
      mode,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && (err.name === "AbortError" || controller.signal.aborted)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TIMEOUT",
            message: "The check took too long. Please try again.",
          },
        },
        { status: 504 }
      );
    }

    const message =
      err instanceof Error ? err.message : "Something went wrong while checking your text.";

    // Prevent leaking raw secrets or stack traces
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHECK_FAILED",
          message:
            message.includes("LLM_API_KEY")
              ? "LLM API key is not configured on the server."
              : "Something went wrong while checking your text.",
        },
      },
      { status: 500 }
    );
  }
}
