# WriteWise — Production AI Writing & Grammar Checker

**WriteWise** is a fast, minimal, accessible, and explainable AI writing assistant that accurately detects spelling, grammar, punctuation, and style issues in arbitrary user text. Powered directly by Google's Gemini API via the official `@google/genai` SDK, WriteWise ensures all AI calls occur exclusively server-side—keeping credentials strictly secure while providing instant inline highlights, structured issue cards, and one-click corrections.

---

## 🚀 What It Does

WriteWise accepts arbitrary text (from a single sentence to technical manuals, code snippets, multiple paragraphs, informal emails, or non-English writing) up to 5,000 characters and checks for:

- **Grammar Errors**: Subject-verb agreement, tense consistency, modal verbs, auxiliary confusion.
- **Spelling Errors**: Typographical mistakes and homophone confusion (e.g., *their* vs. *there* vs. *they're*).
- **Punctuation Errors**: Missing commas, misplaced apostrophes, run-on sentence delimiters, semicolons.
- **Clarity & Sentence Quality**: Awkward phrasing, redundancy, and passive overuse.
- **Mode-Specific Tone Refinement**: Five specialized modes (*Fix errors only*, *Improve clarity*, *Formal*, *Casual*, *Concise*).
- **Automatic Language Detection**: Detects and evaluates text in its native language.
- **Zero-Invention Guarantee**: Prompted conservatively to never invent errors or flag correct sentences.

---

## ✨ Features

- **⚡ Server-Side LLM Execution**: No client-side API credentials; all processing runs via Next.js App Router route handlers.
- **🔍 Deterministic Issue Location**: Client-side character offset calculation with context-aware disambiguation for duplicate phrases and unicode.
- **🛡️ Safe Overlap Resolution**: Non-destructive resolution for overlapping issues that preserves HTML structure and eliminates broken nested spans.
- **✨ Inline Underlines**: Differentiated underline patterns and colors (red wavy for spelling, blue solid for grammar, orange dotted for punctuation, purple dashed for style) compliant with WCAG accessibility standards.
- **🎯 One-Click & "Accept All" Fixes**: Safe right-to-left replacement algorithm prevents offset drift.
- **📋 Corrected Text Panel**: Instant access to the fully corrected version with a 1-click clipboard copy button.
- **💾 Local History Drawer**: Saves the last 20 checks locally in the browser (`localStorage`) with full restoration capabilities. No database or server tracking.
- **🌗 Theme Toggle**: Dark and light themes with automatic system preference detection and zero-hydration-mismatch script.
- **⏱️ In-Memory Rate Limiting**: Protects your API keys with a 20 request/minute/IP limit and proxy-safe header detection.
- **⚡ Chunked Parallel Processing**: Text inputs exceeding 1,500 characters are automatically split on paragraph boundaries and checked across up to 3 concurrent requests.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 14+ (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode enabled)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI & Icons**: [React 18](https://react.dev/), [Lucide React](https://lucide.dev/)
- **Validation**: [Zod](https://zod.dev/) (Strict request and response schemas)
- **Testing**: [Vitest](https://vitest.dev/)
- **LLM SDK**: Official [@google/genai](https://www.npmjs.com/package/@google/genai)

---

## 📐 Architecture & Data Flow

```
[ User Browser / Client ]
       │
       ▼ (POST /api/check { text, mode })
[ Next.js API Route Handler (Server-Side) ]
       │
       ├── Rate Limiter (20 req/min/IP)
       ├── Zod Validation (Text 1-5000 chars, Mode check)
       │
       ▼ (Server-only LLM_API_KEY)
[ lib/llm.ts Provider Abstraction ]
       │
       ├── Mode-aware System Prompt (lib/prompt.ts)
       ├── Paragraph Boundary Chunking (>1500 chars, max 3 concurrent)
       │
       └──► [ Google Gemini API (gemini-3.8-flash via @google/genai) ]
       │
       ▼ (Strict Zod Validation with 1-Attempt Retry)
[ JSON Response { language, correctedText, issues, score } ]
       │
       ▼
[ Client React State (Source text = Single Source of Truth) ]
       │
       ├── lib/locate.ts (Context matching & duplicate disambiguation)
       ├── lib/locate.ts (Deterministic overlap resolution)
       └── HighlightedText / IssueCard / Summary / CorrectedText
```

---

## 📂 Project Structure

```text
app/
  page.tsx                  # Single-screen responsive workspace
  layout.tsx                # Root layout with hydration-safe theme initialization
  globals.css               # Tailwind directives and accessible category underline styles
  api/
    check/
      route.ts              # Server-side check endpoint with rate limiting & timeouts

components/
  Editor.tsx                # Accessible textarea with live counts, 5k limit & shortcuts
  HighlightedText.tsx       # Safe segment rendering with accessible underlines
  IssueCard.tsx             # Interactive card with original, suggestion & explanation
  Summary.tsx               # Simple score badge and category breakdown
  ModeSelect.tsx            # 5-mode segmented selector
  HistoryDrawer.tsx         # Slide-over drawer with 20-entry local history
  ThemeToggle.tsx           # Dark/light mode switcher with persistence

lib/
  llm.ts                    # Google Gemini LLM abstraction, structured output & parallel chunking
  prompt.ts                 # Mode-aware copy editor system prompts & directives
  schema.ts                 # Strict Zod schemas for requests, responses & issues
  locate.ts                 # Offset calculation, context scoring, overlaps & right-to-left fixes
  rateLimit.ts              # In-memory IP rate limiter (20 req/min)
  history.ts                # Resilient client-side localStorage persistence

tests/
  locate.test.ts            # Unit tests for offsets, unicode, duplicates & overlaps
  schema.test.ts            # Unit tests for Zod validation, word counts & error cases

.env.example                # Template for environment variables
.env.local                  # Local environment file (strictly git-ignored)
.gitignore                  # Git exclusions (guarantees .env*.local are never committed)
README.md                   # Full documentation
package.json                # Dependencies and npm scripts
tsconfig.json               # Strict TypeScript configuration
tailwind.config.ts          # Tailwind styling tokens
postcss.config.mjs          # PostCSS processor configuration
vitest.config.ts            # Test runner configuration
```

---

## ⚡ Getting Started (Local Setup)

### 1. Install Dependencies

```bash
npm install
```

### 2. Obtain a Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"** and copy your generated key.

### 3. Configure Environment Variables

Create your local environment file from the example template:

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Gemini credentials:

```ini
LLM_PROVIDER=gemini
LLM_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-3.8-flash
LLM_BASE_URL=
```

> **Security Note**: Never commit `.env.local` or expose `LLM_API_KEY` to client-side code. `.env.local` is already included in `.gitignore`.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## ⚙️ Environment Variables

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `LLM_PROVIDER` | No | Target provider (`gemini` or `openai-compatible`). Defaults to `gemini`. | `gemini` |
| `LLM_API_KEY` | **Yes** | Secret API key for Google Gemini. Kept strictly on the server. | `AIzaSy...` |
| `LLM_MODEL` | No | Gemini model identifier. Defaults to `gemini-3.8-flash`. | `gemini-3.8-flash` |
| `LLM_BASE_URL` | No | Optional custom base URL if using a proxy or custom endpoint. | *(empty)* |

---

## 🔒 Security Architecture

- **No Secrets in Client Bundle**: All LLM calls happen strictly in `/app/api/check/route.ts` on the server. The browser never receives or possesses the API key.
- **Strict Input Validation**: Zod verifies text length (1 to 5,000 characters) and allowed modes before invoking any AI routines.
- **XSS & Code Injection Prevention**: Text is rendered as plain React text nodes, never through `dangerouslySetInnerHTML`. Code blocks in user text are displayed safely as raw string data.
- **Rate Limiting**: Enforces a 20 request/minute/IP limit to safeguard against API abuse and accidental runaway scripts.
- **Privacy First**: No server-side database. User writing drafts are neither saved to disk nor logged.

---

## 🧪 Testing

### Running Automated Tests

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Validate production build
npm run build
```

Test coverage includes:
- **`tests/locate.test.ts`**: Duplicate substrings, unicode accents, emoji handling, repeated phrases, overlapping issue resolution, non-existent strings, and right-to-left fix application.
- **`tests/schema.test.ts`**: Valid LLM responses, invalid category rejection, missing fields, score boundary enforcement, 25-word explanation caps, and malformed requests.

---

## ☁️ Vercel Deployment

WriteWise is optimized for instantaneous deployment to Vercel without Docker or separate servers:

1. **Push to GitHub**:
   Ensure your code is committed to a GitHub repository (verify `.env.local` is not committed).
2. **Import into Vercel**:
   Go to [Vercel](https://vercel.com/) and click **"Add New Project"** -> Select your WriteWise repository.
3. **Configure Environment Variables in Vercel**:
   Under **Settings > Environment Variables**, add the following keys for Production and Preview:
   - `LLM_PROVIDER`: `gemini`
   - `LLM_API_KEY`: Your Gemini API key (e.g., `AIzaSy...`)
   - `LLM_MODEL`: `gemini-3.8-flash`
   - *(Optional)* `LLM_BASE_URL`: Leave empty unless routing through a proxy
4. **Deploy**:
   Click **Deploy**. Next.js will build the production static pages and serverless API route.
5. **Verify**:
   Test a check from the live Vercel URL. You can also monitor real-time invocation logs in the Vercel Dashboard under **Logs**.
6. **Updating Environment Variables**:
   Any environment variable modification requires triggering a new deployment in Vercel to take effect.

---

## ❓ Troubleshooting

### 1. "Gemini API key is not configured on the server"
- Ensure `.env.local` exists in your project root folder and contains `LLM_API_KEY`.
- If deployed on Vercel, check that `LLM_API_KEY` was added in Vercel project settings under **Environment Variables** and redeploy.

### 2. "Invalid Gemini API key. Please check your credentials." (HTTP 401)
- Verify that your Gemini API key is valid and has access to Gemini models at [Google AI Studio](https://aistudio.google.com/).

### 3. "Gemini API rate limit or quota exceeded." (HTTP 429)
- You have hit the rate limit or quota for your Gemini API tier. Wait a few moments before submitting another check.

### 4. "Too many checks. Please wait a moment and try again." (HTTP 429)
- You have exceeded WriteWise's built-in 20 requests per minute IP rate limit. Wait 60 seconds before making additional checks.

### 5. "The check took too long. Please try again." (HTTP 504)
- WriteWise includes a 25-second internal abort controller (well within Vercel's 30-second Serverless execution ceiling). Check your network connection.

### 6. Build or Type Errors
- Ensure you run Node.js 18+ or 20+.
- Run `npm test` and `npm run build` locally before pushing to production.

---

## 📄 License

MIT License. Designed and built cleanly from scratch.
