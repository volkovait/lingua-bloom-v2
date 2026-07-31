import { extractCandidates } from './candidates'

export type MaterialIntent = 'reproduce_test' | 'generate_from_content'

const REPRODUCE_SIGNAL_RE =
  /раскройте\s+скобки|выберите\s+правильн|упражнение\s+\d+|test\s+\d+|\(\s*to\s+\w+|\(\s*not\s+to\s+\w+/i

/** Детерминированное определение intent по материалу (без LLM). */
export function detectMaterialIntent(material: string, title: string): MaterialIntent {
  const { candidates } = extractCandidates(material)
  if (candidates.length >= 1) return 'reproduce_test'

  const combined = `${title}\n${material}`.trim()
  if (REPRODUCE_SIGNAL_RE.test(combined)) return 'reproduce_test'

  return 'generate_from_content'
}

/** Override LLM-intent детерминированными сигналами (приоритет у reproduce). */
export function resolveMaterialIntent(
  llmIntent: MaterialIntent,
  material: string,
  title: string,
): MaterialIntent {
  const detected = detectMaterialIntent(material, title)
  if (detected === 'reproduce_test') return 'reproduce_test'
  return llmIntent
}
