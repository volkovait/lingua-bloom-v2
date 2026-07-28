import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { z } from 'zod'

import { createModel, type CreateModelOptions } from '@/src/llm/model'

export type StructuredCallInput<T extends z.ZodTypeAny> = {
  /** Системная инструкция. */
  system: string
  /** Пользовательский блок (материал/данные). */
  user: string
  /** Zod-схема ожидаемого ответа. */
  schema: T
  /** Имя инструмента structured output (для провайдера). */
  schemaName: string
  /** Готовая модель; иначе создаётся по modelOptions. */
  model?: BaseChatModel
  modelOptions?: CreateModelOptions
  /** Число повторов при невалидном ответе (по умолчанию 1). */
  retries?: number
}

/**
 * Вызывает модель со structured output (zod) и повторяет при невалидном ответе.
 * Возвращает уже провалидированные данные схемы.
 */
export async function callStructured<T extends z.ZodTypeAny>(
  input: StructuredCallInput<T>,
): Promise<z.infer<T>> {
  const model = input.model ?? createModel(input.modelOptions)
  // functionCalling (не strict json_schema): strict-режим OpenAI требует, чтобы все
  // optional-поля были ещё и nullable — наша богатая схема упражнений этого не соблюдает.
  const structured = model.withStructuredOutput(input.schema, {
    name: input.schemaName,
    method: 'functionCalling',
  })
  const attempts = Math.max(1, (input.retries ?? 1) + 1)

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await structured.invoke([
        new SystemMessage(input.system),
        new HumanMessage(input.user),
      ])
      const parsed = input.schema.safeParse(raw)
      if (parsed.success) return parsed.data
      lastError = new Error(`Ответ модели не прошёл валидацию схемы "${input.schemaName}": ${parsed.error.message}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Не удалось получить валидный ответ модели для "${input.schemaName}".`)
}
