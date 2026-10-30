import dns from 'node:dns/promises'
import net from 'node:net'

const MAX_DOWNLOAD_BYTES = Number(process.env.SOURCE_MAX_DOWNLOAD_BYTES || 900_000)
const MAX_EXTRACTED_CHARS = Number(process.env.SOURCE_MAX_EXTRACTED_CHARS || 120_000)
const TIMEOUT_MS = Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 8_000)
const MAX_REDIRECTS = 3

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0
  }
  const normalized = ip.toLowerCase()
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized === '::'
}

async function assertSafe(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.')
  if (url.username || url.password) throw new Error('Credential-bearing URLs are not allowed.')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal' || host === '169.254.169.254') throw new Error('Private destinations are not allowed.')
  const addresses = await dns.lookup(host, { all: true })
  if (addresses.some(({ address }) => isPrivateIp(address))) throw new Error('Private destinations are not allowed.')
}

function decodeEntities(value: string) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
}

function truncateText(text: string) {
  if (text.length <= MAX_EXTRACTED_CHARS) return { text, truncated: false }
  const marker = '\n\n[TRUNCATED: middle of this source was omitted after the extraction safety limit.]\n\n'
  const available = Math.max(0, MAX_EXTRACTED_CHARS - marker.length)
  const head = Math.ceil(available * 0.72)
  const tail = available - head
  return { text: `${text.slice(0, head)}${marker}${text.slice(-tail)}`, truncated: true }
}

function extract(html: string) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '')
  const dates = html.match(/(?:published|modified|updated|datePublished|dateModified)[^\d]{0,30}(20\d{2}[-/]\d{1,2}(?:[-/]\d{1,2})?)/i)?.[1]
  const readable = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|nav|footer|header|aside|form|dialog)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|nav|footer|header|aside|form|dialog)[^>]*\/?>/gi, ' ')
  const main = readable.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || readable
  const text = decodeEntities(main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  const limited = truncateText(text)
  return { title, text: limited.text, truncated: limited.truncated, publishedDate: dates }
}

async function readLimited(response: Response) {
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_DOWNLOAD_BYTES) throw new Error('Source exceeds the download safety limit. Paste the source text instead.')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let body = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel()
        throw new Error('Source exceeds the download safety limit. Paste the source text instead.')
      }
      body += decoder.decode(value, { stream: true })
    }
    return body + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

export async function fetchSource(rawUrl: string) {
  let current = new URL(rawUrl)
  await assertSafe(current)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetch(current, { signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'GapLensAI/1.0 research fetcher', Accept: 'text/html,text/plain;q=0.8' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === MAX_REDIRECTS) throw new Error('The source redirected too many times.')
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect destination was missing.')
        current = new URL(location, current)
        await assertSafe(current)
        continue
      }
      if (!response.ok) throw new Error(`The source returned ${response.status}.`)
      const contentType = response.headers.get('content-type') || ''
      if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) throw new Error('This source is not a readable HTML or text document. PDFs and other files must be pasted as text.')
      const body = await readLimited(response)
      return { ...extract(body), url: current.toString(), domain: current.hostname }
    }
    throw new Error('The source could not be retrieved.')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The source request timed out. Paste the source text instead.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
