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

    const rawMessage =
      err instanceof Error ? err.message : "Something went wrong while checking your text.";

    // Unpack inner error message if wrapped by checkSegmentWithRetry
    const innerMessage = rawMessage
      .replace(/^Failed to obtain valid check results after retry:\s*/i, "")
      .trim();
    const lower = (rawMessage + " " + innerMessage).toLowerCase();

    let statusCode = 500;
    let errorCode = "CHECK_FAILED";
    let userMessage = "Something went wrong while checking your text.";

    if (lower.includes("llm_api_key") || lower.includes("missing llm_api_key")) {
      userMessage = "Gemini API key is not configured on the server. Please set LLM_API_KEY in your environment variables.";
      errorCode = "CONFIG_ERROR";
      statusCode = 500;
    } else if (
      lower.includes("api_key_invalid") ||
      lower.includes("api key not valid") ||
      lower.includes("invalid api key") ||
      lower.includes("api_key_expired") ||
      lower.includes("unauthenticated")
    ) {
      userMessage = "Invalid Gemini API key. Please verify LLM_API_KEY in your environment variables.";
      errorCode = "INVALID_API_KEY";
      statusCode = 401;
    } else if (
      lower.includes("resource_exhausted") ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("429")
    ) {
      userMessage = "Gemini API rate limit or quota exceeded. Please wait a moment and try again.";
      errorCode = "RATE_LIMITED";
      statusCode = 429;
    } else if (lower.includes("not found") || lower.includes("is not supported")) {
      userMessage = "Configured AI model was not found or is unavailable. Please verify LLM_MODEL.";
      errorCode = "MODEL_NOT_FOUND";
      statusCode = 404;
    } else if (
      lower.includes("fetch failed") ||
      lower.includes("network") ||
      lower.includes("econnrefused") ||
      lower.includes("etimedout")
    ) {
      userMessage = "Network error connecting to Gemini API. Please check your connection.";
      errorCode = "NETWORK_ERROR";
      statusCode = 503;
    } else if (lower.includes("failed to obtain valid check results after retry")) {
      userMessage = "The AI provider returned an unexpected data format. Please try again.";
      errorCode = "VALIDATION_FAILED";
      statusCode = 502;
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: userMessage,
        },
      },
      { status: statusCode }
    );
  }
}
