import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { CheckMode, LLMResponse, LLMResponseSchema } from "./schema";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";

export interface CheckOptions {
  mode: CheckMode;
  signal?: AbortSignal;
}

const TOOL_SCHEMA: Anthropic.Tool = {
  name: "submit_writing_check",
  description: "Submit the structured writing check results",
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        description: "Detected natural language of the input (e.g. English, Spanish)",
      },
      correctedText: {
        type: "string",
        description: "The complete text with all corrections and adjustments applied",
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: {
              type: "string",
              description: "Exact substring in original text",
            },
            suggestion: {
              type: "string",
              description: "Suggested replacement",
            },
            category: {
              type: "string",
              enum: ["spelling", "grammar", "punctuation", "style"],
            },
            explanation: {
              type: "string",
              description: "Explanation in 25 words or fewer",
            },
            context: {
              type: "string",
              description: "Surrounding ~30 chars around the issue",
            },
          },
          required: ["original", "suggestion", "category", "explanation", "context"],
        },
      },
      score: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Quality score from 0 to 100",
      },
    },
    required: ["language", "correctedText", "issues", "score"],
  },
};

/**
 * Execute a single LLM check request for a text segment.
 */
async function callLLMProvider(
  text: string,
  mode: CheckMode,
  signal?: AbortSignal
): Promise<unknown> {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(
      `Missing LLM_API_KEY for provider "${provider}". Please configure it in your server environment.`
    );
  }

  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt(text);

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const model = process.env.LLM_MODEL || "claude-haiku-4-5-20251001";

    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "submit_writing_check" },
      },
      { signal }
    );

    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_writing_check"
    );

    if (toolUseBlock && typeof toolUseBlock.input === "object") {
      return toolUseBlock.input;
    }

    // Fallback: Check if response has JSON in text content
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      return JSON.parse(textBlock.text);
    }

    throw new Error("Anthropic did not return structured check output.");
  } else if (provider === "openai-compatible") {
    const client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || undefined,
    });
    const model = process.env.LLM_MODEL || "gpt-4o-mini";

    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      },
      { signal }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI-compatible provider.");
    }

    return JSON.parse(content);
  } else {
    throw new Error(
      `Unsupported LLM_PROVIDER: "${provider}". Expected "anthropic" or "openai-compatible".`
    );
  }
}

/**
 * Execute a check with a single retry if schema validation fails.
 */
async function checkSegmentWithRetry(
  text: string,
  mode: CheckMode,
  signal?: AbortSignal
): Promise<LLMResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callLLMProvider(text, mode, signal);
      const parsed = LLMResponseSchema.parse(raw);
      return parsed;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 1) {
        // Wait 300ms before retrying once
        await new Promise((res) => setTimeout(res, 300));
      }
    }
  }

  throw new Error(
    `Failed to obtain valid check results after retry: ${lastError?.message || "Unknown schema error"}`
  );
}

interface Chunk {
  text: string;
  separatorAfter: string;
}

/**
 * Split text exceeding 1,500 characters by paragraph boundaries without splitting words.
 */
function splitIntoParagraphChunks(text: string, maxChunkLength = 1500): Chunk[] {
  if (text.length <= maxChunkLength) {
    return [{ text, separatorAfter: "" }];
  }

  // Split by double newlines or single newlines
  const rawParagraphs = text.split(/(\r?\n\r?\n)/);
  const chunks: Chunk[] = [];
  let currentText = "";
  let currentSep = "";

  for (let i = 0; i < rawParagraphs.length; i += 2) {
    const para = rawParagraphs[i] || "";
    const sep = rawParagraphs[i + 1] || "";

    if (!currentText) {
      currentText = para;
      currentSep = sep;
    } else if (currentText.length + currentSep.length + para.length <= maxChunkLength) {
      currentText += currentSep + para;
      currentSep = sep;
    } else {
      chunks.push({ text: currentText, separatorAfter: currentSep });
      currentText = para;
      currentSep = sep;
    }
  }

  if (currentText) {
    chunks.push({ text: currentText, separatorAfter: currentSep });
  }

  // If a single chunk is still > maxChunkLength, split by sentence boundaries
  const refinedChunks: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.text.length <= maxChunkLength) {
      refinedChunks.push(chunk);
      continue;
    }

    const sentences = chunk.text.split(/([.?!]\s+)/);
    let sText = "";
    let sSep = "";

    for (let j = 0; j < sentences.length; j += 2) {
      const s = sentences[j] || "";
      const delimiter = sentences[j + 1] || "";

      if (!sText) {
        sText = s;
        sSep = delimiter;
      } else if (sText.length + sSep.length + s.length <= maxChunkLength) {
        sText += sSep + s;
        sSep = delimiter;
      } else {
        refinedChunks.push({ text: sText, separatorAfter: sSep });
        sText = s;
        sSep = delimiter;
      }
    }

    if (sText) {
      refinedChunks.push({
        text: sText,
        separatorAfter: sSep + chunk.separatorAfter,
      });
    }
  }

  return refinedChunks.length > 0 ? refinedChunks : [{ text, separatorAfter: "" }];
}

/**
 * Execute asynchronous tasks with a maximum concurrency limit.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Primary entry point: checks arbitrary text using the configured LLM.
 * Handles parallel chunking for texts > 1,500 characters with a max concurrency of 3.
 */
export async function runCheck(
  text: string,
  options: CheckOptions
): Promise<LLMResponse> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      language: "English",
      correctedText: text,
      issues: [],
      score: 100,
    };
  }

  // Handle inputs <= 1,500 characters directly
  if (text.length <= 1500) {
    return checkSegmentWithRetry(text, options.mode, options.signal);
  }

  // Handle inputs > 1,500 characters: Split by paragraph boundaries
  const chunks = splitIntoParagraphChunks(text, 1500);

  // Maximum 3 concurrent requests
  const chunkResults = await runWithConcurrency(chunks, 3, async (chunk) => {
    if (!chunk.text.trim()) {
      return {
        language: "English",
        correctedText: chunk.text,
        issues: [],
        score: 100,
      };
    }
    return checkSegmentWithRetry(chunk.text, options.mode, options.signal);
  });

  // Merge results
  let mergedCorrectedText = "";
  const allIssues: LLMResponse["issues"] = [];
  let totalScoreWeight = 0;
  let weightedScoreSum = 0;
  let detectedLanguage = "English";

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const res = chunkResults[i];

    mergedCorrectedText += res.correctedText + chunk.separatorAfter;
    allIssues.push(...res.issues);

    const weight = Math.max(1, chunk.text.length);
    weightedScoreSum += res.score * weight;
    totalScoreWeight += weight;

    if (res.language && detectedLanguage === "English") {
      detectedLanguage = res.language;
    }
  }

  const finalScore = Math.round(weightedScoreSum / Math.max(1, totalScoreWeight));

  return {
    language: detectedLanguage,
    correctedText: mergedCorrectedText,
    issues: allIssues,
    score: Math.min(100, Math.max(0, finalScore)),
  };
}
