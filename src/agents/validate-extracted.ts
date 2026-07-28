import type { ExtractedCandidate } from '@/src/extract/types'
import { callStructured } from '@/src/llm/structured'

import { EXERCISE_CONTRACT, partExercisesSchema, type PartExercises } from './exercise-contract'

const SYSTEM = `Ты нормализуешь УЖЕ ГОТОВЫЕ задания (извлечённые парсером из материала) в структуру упражнений.

КРИТИЧЕСКИ ВАЖНО — принцип «извлечение, не выдумывание»:
- Текст вопросов и вариантов копируй ДОСЛОВНО из переданных кандидатов. НЕ переписывай, НЕ добавляй новые вопросы, НЕ придумывай варианты.
- Твоя задача — только: (1) выбрать правильный inputKind, (2) привести к структуре, (3) проставить правильный ответ.
- Правильный ответ бери из поля answer кандидата. Если answer = null — определи ответ строго по материалу части; если из материала он не выводится однозначно, выбери наиболее вероятный (позже это можно уточнить). Не выдумывай факты.
- Кандидаты kind="gap" → gapFill (или gapDrag, если в материале явно есть банк слов). kind="mcq" → radio. kind="trueFalse" → radio с вариантами Верно/Неверно.
- Сгруппируй родственные вопросы в упражнения с осмысленными заголовками.

${EXERCISE_CONTRACT}`

/** LLM-валидация/нормализация извлечённых кандидатов в упражнения (без «додумывания»). */
export async function validateExtractedPart(input: {
  lessonTitle: string
  partTitle: string
  partText: string
  candidates: ExtractedCandidate[]
  answersHint?: string
}): Promise<PartExercises> {
  const user = [
    `Тема урока: ${input.lessonTitle.trim() || '(не указано)'}`,
    `Название части: ${input.partTitle.trim() || '(без названия)'}`,
    '',
    '### Извлечённые кандидаты (JSON)',
    JSON.stringify(input.candidates, null, 2).slice(0, 40_000),
    '',
    '### Текст части (контекст для определения правильных ответов)',
    input.partText.trim().slice(0, 30_000),
    ...(input.answersHint?.trim()
      ? ['', '### Правильные ответы от пользователя (приоритет над догадками)', input.answersHint.trim().slice(0, 8_000)]
      : []),
  ].join('\n')

  return callStructured({
    system: SYSTEM,
    user,
    schema: partExercisesSchema,
    schemaName: 'validated_part_exercises',
    modelOptions: { role: 'spec', temperature: 0 },
    retries: 1,
  })
}
