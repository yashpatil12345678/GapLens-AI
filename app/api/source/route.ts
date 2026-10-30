import { fetchSource } from '@/lib/source-fetcher'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string }
    if (!body.url?.trim() || body.url.length > 2048) return Response.json({ error: 'Enter a valid public URL.' }, { status: 400 })
    const data = await fetchSource(body.url.trim())
    if (!data.text || data.text.length < 80) return Response.json({ error: 'The page did not contain enough readable text. Paste the source text instead.' }, { status: 422 })
    return Response.json({ ...data, status: 'retrieved' })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not retrieve this source.' }, { status: 422 }) }
}
