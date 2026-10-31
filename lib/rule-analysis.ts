import type { Analysis, Source } from './types'

const STOP_WORDS = new Set('about after again against all also and are been being but can could does for from had has have how into its may more most not our should that the their them then there these they this those through was were what when where which who with would you your'.split(' '))
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
const sentences = (value: string) => normalize(value).split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(normalize).filter((sentence) => sentence.length >= 20)
const words = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((word) => !STOP_WORDS.has(word)))
const dates = (value: string) => value.match(/\b(?:19|20)\d{2}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi) || []
const numbers = (value: string) => value.match(/\b\d+(?:\.\d+)?\s*%?|\$\s*\d[\d,]*(?:\.\d+)?\b/g) || []

function evidenceFor(source: Source, questionWords: Set<string>) {
  const sourceSentences = sentences(source.text)
  const scored = sourceSentences.map((passage) => ({ passage, score: [...words(passage)].filter((word) => questionWords.has(word)).length }))
  return (scored.sort((a, b) => b.score - a.score)[0] || { passage: sourceSentences[0] || normalize(source.text).slice(0, 280), score: 0 }).passage
}

export function analyzeWithRules(question: string, sources: Source[]): Analysis {
  const questionWords = words(question)
  const sourceEvidence = sources.map((source) => ({ source, passage: evidenceFor(source, questionWords), sentences: sentences(source.text) }))
  const allEvidence = sourceEvidence.flatMap(({ source, passage }) => ({ source, passage }))
  const keyFindings = allEvidence.slice(0, 8).map(({ source, passage }, index) => ({ title: `Extracted statement ${index + 1}`, summary: passage, sourceIds: [source.id], evidence: [passage], confidence: 'Heuristic extraction; verify against the source' }))
  const coveredWords = new Set(allEvidence.flatMap(({ passage }) => [...words(passage)]))
  const missingTopics = [...questionWords].filter((word) => !coveredWords.has(word)).slice(0, 4)
  const gaps: Analysis['gaps'] = missingTopics.length ? [{ title: 'Question topics not clearly covered', explanation: `Potential gap: the sources reviewed did not clearly address these question terms: ${missingTopics.join(', ')}.`, whyItMatters: 'The submitted evidence may not fully answer the research objective.', sourceIds: sources.map((source) => source.id), evidence: 'No closely matching passage was found by the transparent keyword heuristic.', action: 'Find a current, authoritative source that addresses the missing topic directly.', priority: 'High', confidence: 'Heuristic signal; not proof that the information is unavailable' }] : []
  const contradictions: Analysis['contradictions'] = []
  for (let i = 0; i < sourceEvidence.length; i++) for (let j = i + 1; j < sourceEvidence.length; j++) {
    const left = sourceEvidence[i]; const right = sourceEvidence[j]
    const leftNumbers = numbers(left.source.text).map((value) => value.replace(/\s/g, ''))
    const rightNumbers = numbers(right.source.text).map((value) => value.replace(/\s/g, ''))
    const leftDates = dates(left.source.text).map((value) => value.toLowerCase())
    const rightDates = dates(right.source.text).map((value) => value.toLowerCase())
    const numberConflict = leftNumbers.length && rightNumbers.length && leftNumbers.some((value) => !rightNumbers.includes(value)) && rightNumbers.some((value) => !leftNumbers.includes(value))
    const dateConflict = leftDates.length && rightDates.length && leftDates[0] !== rightDates[0]
    if (numberConflict || dateConflict) contradictions.push({ topic: numberConflict ? 'Different numerical values' : 'Different dates', claims: [{ sourceId: left.source.id, claim: left.passage, passage: left.passage }, { sourceId: right.source.id, claim: right.passage, passage: right.passage }], explanation: 'Potential contradiction detected by comparing explicit values or dates. Context, scope, units, and publication cycles may explain the difference.', action: 'Review both passages and verify the current authoritative value.', priority: numberConflict ? 'High' : 'Medium' })
  }
  const outdated: Analysis['outdated'] = sourceEvidence.flatMap(({ source }) => dates(source.text).filter((date) => Number(date.match(/(?:19|20)\d{2}/)?.[0]) < new Date().getFullYear() - 1).map((date) => ({ sourceId: source.id, observedDate: date, reason: 'The source contains an earlier explicit date; age alone does not prove the statement is wrong.', action: 'Check whether a newer source or current policy supersedes it.', priority: 'Medium' })))
  const checklist: Analysis['checklist'] = [
    ...gaps.map((gap) => ({ task: gap.action, reason: gap.explanation, priority: gap.priority, sourceIds: gap.sourceIds, completed: false })),
    ...contradictions.map((item) => ({ task: item.action, reason: item.explanation, priority: item.priority, sourceIds: item.claims.map((claim) => claim.sourceId), completed: false })),
    ...outdated.map((item) => ({ task: item.action, reason: item.reason, priority: item.priority, sourceIds: [item.sourceId], completed: false })),
  ].slice(0, 10)
  return { overview: { sourcesSubmitted: sources.length, sourcesProcessed: sources.filter((source) => source.status !== 'failed').length, keyFindings: keyFindings.length, gaps: gaps.length, contradictions: contradictions.length, outdated: outdated.length, tasks: checklist.length }, keyFindings, gaps, contradictions, outdated, checklist }
}
