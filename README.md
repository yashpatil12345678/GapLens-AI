# GapLens AI

> Don’t just find information. Find what’s missing.

GapLens AI is a full-stack research verification workspace for the Shinchan Online Hackathon 2026 problem statement, **Digital Dark Spot — AI-Assisted Information Gap Detection Platform**.

## Architecture

- Next.js App Router with responsive research workspace.
- `POST /api/source` performs server-side public-page retrieval with URL validation, DNS/private-network blocking, redirect revalidation, timeout, content-type, download-size, readable-text, and truncation safeguards.
- `POST /api/analyze` runs a deterministic, no-key rule-based analyzer. It normalizes text, extracts sentences, matches question topics, preserves exact evidence passages, detects potential conflicts in values/requirements, flags explicit older years, identifies missing question topics, and creates a prioritized verification checklist.
- No external AI provider, API key, database, or paid service is required for the core workflow.

The analyzer is intentionally not generative AI. It cannot establish truth, understand unstated context, or replace human verification. Every signal is labelled as heuristic and points back to supplied source text.

## Setup and deployment

1. Import or publish the project to Vercel.
2. Deploy normally. `GEMINI_API_KEY`, `AI_GATEWAY_API_KEY`, and `API_KEY` are not required and may be removed from the project environment after confirming no other project uses them.
3. The app will work in Preview and Production without provider configuration.

## Demo

Click **Load demo** in the research workspace. The demo loads three clearly labelled synthetic scholarship documents and precomputed demonstration findings. Demo results are explicitly marked `DEMO DATA` and are never presented as live analysis.

For a live no-key demonstration, paste two or more source passages, ask a focused question, and click **Analyze research gaps**. The result banner identifies the mode as offline rule-based analysis.

## Testing guide

- Paste multiple passages with different numerical requirements or dates; the analyzer should show potential contradiction and outdated-date signals with both passages.
- Leave the question or sources empty to verify validation.
- Try `localhost`, a private IP, credentials in a URL, non-HTTP schemes, a PDF, and oversized pages; the source endpoint rejects or explains each safely.
- Load the demo and mark checklist items complete.
- Test on a narrow mobile viewport; controls stack and evidence remains readable.

## Limitations and responsible use

The rule-based engine uses transparent lexical heuristics. It may miss paraphrases, semantic contradictions, implied dates, dynamically rendered page content, paywalls, PDFs, or context-dependent meanings. A potential gap means only that the information was not found in submitted sources; it does not mean the information does not exist. A potential contradiction may be explained by dates, definitions, units, or scope. Verify important claims with authoritative sources.

Sessions are browser-held and not persisted. Source pages are treated as untrusted evidence and their instructions are never executed.
