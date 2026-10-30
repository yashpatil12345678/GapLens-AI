export type Source = { id: string; url?: string; title: string; text: string; domain?: string; status: 'manual' | 'retrieved' | 'failed'; retrievedAt?: string; publishedDate?: string; error?: string; truncated?: boolean }

export type Analysis = {
  overview: { sourcesSubmitted: number; sourcesProcessed: number; keyFindings: number; gaps: number; contradictions: number; outdated: number; tasks: number }
  keyFindings: { title: string; summary: string; sourceIds: string[]; evidence: string[]; confidence: string }[]
  gaps: { title: string; explanation: string; whyItMatters: string; sourceIds: string[]; evidence: string; action: string; priority: 'High' | 'Medium' | 'Low'; confidence: string }[]
  contradictions: { topic: string; claims: { sourceId: string; claim: string; passage: string }[]; explanation: string; action: string; priority: 'High' | 'Medium' | 'Low' }[]
  outdated: { sourceId: string; observedDate: string; reason: string; action: string; priority: 'High' | 'Medium' | 'Low' }[]
  checklist: { task: string; reason: string; priority: 'High' | 'Medium' | 'Low'; sourceIds: string[]; completed: boolean }[]
}
