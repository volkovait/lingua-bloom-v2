import type { RunnableConfig } from '@langchain/core/runnables'

/**
 * Конфиг invoke для LangGraph с метаданными под LangSmith.
 * Трейсинг включается env: LANGSMITH_TRACING=true + LANGSMITH_API_KEY
 * (см. .env.example). Без них приложение работает как раньше.
 */
export function buildGraphInvokeConfig(input: {
  threadId: string
  runId?: string
  userId?: string
  recursionLimit?: number
  tags?: string[]
}): RunnableConfig {
  const tags = ['lingua-bloom', 'generation', ...(input.tags ?? [])]
  const metadata: Record<string, string> = {}
  if (input.runId) metadata.runId = input.runId
  if (input.userId) metadata.userId = input.userId
  if (input.threadId) metadata.threadId = input.threadId

  return {
    configurable: { thread_id: input.threadId },
    recursionLimit: input.recursionLimit ?? 80,
    runName: input.runId ? `generation-${input.runId}` : 'generation',
    tags,
    metadata,
  }
}

/** true, если трейсинг явно включён и задан API-ключ. */
export function isLangSmithTracingEnabled(): boolean {
  const tracing = process.env.LANGSMITH_TRACING?.trim().toLowerCase()
  const enabled = tracing === 'true' || tracing === '1' || tracing === 'yes' || tracing === 'on'
  return enabled && Boolean(process.env.LANGSMITH_API_KEY?.trim())
}
