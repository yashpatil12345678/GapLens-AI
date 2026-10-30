import dns from 'node:dns/promises'
import net from 'node:net'

const MAX_BYTES = 900_000
const TIMEOUT_MS = 8_000

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')
}

async function assertSafe(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.')
  if (url.username || url.password) throw new Error('Credential-bearing URLs are not allowed.')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') throw new Error('Private destinations are not allowed.')
  const addresses = await dns.lookup(host, { all: true })
  if (addresses.some(({ address }) => isPrivateIp(address))) throw new Error('Private destinations are not allowed.')
}

function extract(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || ''
  const dates = html.match(/(?:published|modified|updated|datePublished|dateModified)[^\d]{0,30}(20\d{2}[-/]\d{1,2}(?:[-/]\d{1,2})?)/i)?.[1]
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 120000)
  return { title, text, publishedDate: dates }
}

async function readLimited(response: Response) {
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_BYTES) throw new Error('Source is larger than the safety limit.')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let body = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Source is larger than the safety limit.') }
    body += decoder.decode(value, { stream: true })
  }
  return body + decoder.decode()
}

export async function fetchSource(rawUrl: string) {
  let current = new URL(rawUrl)
  await assertSafe(current)
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    for (let redirect = 0; redirect <= 3; redirect++) {
      const response = await fetch(current, { signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'GapLensAI/1.0 research fetcher', Accept: 'text/html,text/plain;q=0.8' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === 3) throw new Error('The source redirected too many times.')
        const location = response.headers.get('location'); if (!location) throw new Error('Redirect destination was missing.')
        current = new URL(location, current); await assertSafe(current)
        continue
      }
      if (!response.ok) throw new Error(`The source returned ${response.status}.`)
      const contentType = response.headers.get('content-type') || ''
      if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) throw new Error('The source is not a readable HTML or text document.')
      const body = await readLimited(response)
      return { ...extract(body), url: current.toString(), domain: current.hostname }
    }
    throw new Error('The source could not be retrieved.')
  } finally { clearTimeout(timer) }
}
