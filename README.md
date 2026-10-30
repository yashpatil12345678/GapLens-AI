# GapLens AI

> Don’t just find information. Find what’s missing.

GapLens AI is a full-stack research verification workspace for the Shinchan Online Hackathon 2026 problem statement, **Digital Dark Spot — AI-Assisted Information Gap Detection Platform**. It compares user-provided source text, flags potential gaps, conflicting claims, date signals, and creates a verification checklist.

## Setup in Vercel

1. Import or publish this project to Vercel.
2. In the project dashboard, open **Settings → Integrations** and connect **Vercel AI Gateway**.
3. Redeploy or refresh the preview. The app reads `AI_GATEWAY_API_KEY` only on the server.

No database is required: a research session lives in the browser until the user starts a new session. Source fetching and AI analysis run in Next.js server routes.

## Routes

- `POST /api/source` — validates and safely retrieves a public HTTP(S) page with redirect, DNS, timeout, and size protections.
- `POST /api/analyze` — calls a structured AI response through Vercel AI Gateway and validates it with Zod.

## Testing guide

- Load the clearly labelled synthetic scholarship demonstration and run analysis after connecting AI Gateway.
- Add a public URL, verify its retrieved status, then add pasted text as a fallback.
- Try `localhost`, a private IP, credentials in a URL, and non-HTTP schemes; each should be rejected.
- Remove a source before analysis and mark checklist items complete after results appear.
- Disconnect or omit AI Gateway and confirm the UI shows setup guidance rather than fabricated results.
- Test at a narrow mobile viewport; controls stack and evidence remains readable.

## Limitations

Extraction is intentionally lightweight and best suited to public HTML/text pages. JavaScript-rendered pages, paywalls, PDFs, robots restrictions, and complex layouts may require pasted text. AI findings are evidence triage, not proof of truth; always verify high-priority items against primary sources. The app does not persist sessions or provide web-wide search.
