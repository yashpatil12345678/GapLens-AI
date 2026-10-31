import { z } from 'zod'
import { analyzeWithRules } from '@/lib/rule-analysis'

const sourceSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().max(300),
  text: z.string().min(1).max(180_000),
  url: z.string().url().optional(),
  domain: z.string().optional(),
  status: z.enum(['manual', 'retrieved', 'failed']),
  publishedDate: z.string().optional(),
  truncated: z.boolean().optional(),
})
const requestSchema = z.object({ question: z.string().trim().min(12).max(2_000), sources: z.array(sourceSchema).min(1).max(12) })

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json())
    const usableSources = payload.sources.filter((source) => source.status !== 'failed' && source.text.trim().length >= 20)
    if (!usableSources.length) return Response.json({ error: 'No usable source text was provided. Paste text for an inaccessible URL and retry.' }, { status: 422 })
    const analysis = analyzeWithRules(payload.question, usableSources)
    return Response.json({ ...analysis, mode: 'rule-based', notice: 'Local rule-based analysis: not an LLM. Signals are extracted only from supplied text and require human verification.' })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: 'Enter a research question of at least 12 characters and add at least one usable source.' }, { status: 400 })
    console.error('[GapLens] rule analysis failed', { message: error instanceof Error ? error.message.slice(0, 160) : 'unknown error' })
    return Response.json({ error: 'The local analysis engine could not process this request. Check the source text and retry.' }, { status: 500 })
  }
}
