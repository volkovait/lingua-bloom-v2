import { callStructured } from '@/src/llm/structured'

import { EXERCISE_CONTRACT, partExercisesSchema, type PartExercises } from './exercise-contract'

const SYSTEM = `Ты составляешь проверяемые задания по учебному тексту части урока (когда готовых заданий в материале НЕТ).

Правила:
- Опирайся ТОЛЬКО на факты из текста части — не добавляй сведения извне.
- 3–6 упражнений на часть. ПРЕДПОЧИТАЙ надёжные форматы: radio и gapFill (matchPairs/wordOrder — только если уверен, что структура верная).
- Строго соблюдай контракт формата, иначе задание будет отброшено:
  - radio: 2+ options с ключами A,B,C…; correctKey ДОЛЖЕН быть равен key одного из options.
  - gapFill: в gapTemplate ровно один маркер «___»; gapCorrectToken — слово для него.
- В каждом упражнении минимум 3 вопроса, у каждого уникальный id.
- Правильные ответы обязательно верны относительно текста.

${EXERCISE_CONTRACT}`

/** Генерация упражнений для части, где парсер не нашёл готовых заданий. */
export async function generatePartExercises(input: {
  lessonTitle: string
  partTitle: string
  partText: string
  answersHint?: string
}): Promise<PartExercises> {
  const user = [
    `Тема урока: ${input.lessonTitle.trim() || '(не указано)'}`,
    `Название части: ${input.partTitle.trim() || '(без названия)'}`,
    '',
    '### Текст части',
    input.partText.trim().slice(0, 40_000),
    ...(input.answersHint?.trim()
      ? ['', '### Подсказка с ответами от пользователя', input.answersHint.trim().slice(0, 8_000)]
      : []),
  ].join('\n')

  return callStructured({
    system: SYSTEM,
    user,
    schema: partExercisesSchema,
    schemaName: 'generated_part_exercises',
    modelOptions: { role: 'spec', temperature: 0.2 },
    retries: 2,
  })
}
