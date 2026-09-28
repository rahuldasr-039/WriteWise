import { z } from "zod";

export const CheckModeSchema = z.enum([
  "fix",
  "clarity",
  "formal",
  "casual",
  "concise",
]);

export type CheckMode = z.infer<typeof CheckModeSchema>;

export const IssueCategorySchema = z.enum([
  "spelling",
  "grammar",
  "punctuation",
  "style",
]);

export type IssueCategory = z.infer<typeof IssueCategorySchema>;

export const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

export const IssueSchema = z.object({
  original: z.string().min(1, "Original text cannot be empty"),
  suggestion: z.string(),
  category: IssueCategorySchema,
  explanation: z
    .string()
    .min(1, "Explanation cannot be empty")
    .refine((val) => countWords(val) <= 25, {
      message: "Explanation must be 25 words or fewer",
    }),
  context: z.string().default(""),
});

export type Issue = z.infer<typeof IssueSchema>;

export const LLMResponseSchema = z.object({
  language: z.string().min(1, "Language must be specified"),
  correctedText: z.string(),
  issues: z.array(IssueSchema),
  score: z
    .number()
    .min(0, "Score cannot be less than 0")
    .max(100, "Score cannot be greater than 100"),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

export const CheckRequestSchema = z.object({
  text: z
    .string({ required_error: "Please enter some text to check." })
    .trim()
    .min(1, "Please enter some text to check.")
    .max(5000, "Your text is too long. Maximum 5,000 characters."),
  mode: CheckModeSchema.default("fix"),
});

export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export interface ApiSuccessResponse {
  success: true;
  result: LLMResponse;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
