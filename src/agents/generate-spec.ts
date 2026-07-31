import { callStructured } from '@/src/llm/structured'

import { EXERCISE_CONTRACT, partExercisesSchema, type PartExercises } from './exercise-contract'

const SYSTEM = `Ты составляешь проверяемые задания по учебному тексту части урока (когда готовых заданий в материале НЕТ).

Правила:
- Опирайся ТОЛЬКО на факты из текста части — не добавляй сведения извне.
- Минимум нужных вопросов: 1–2 упражнения на короткий текст, до 3 на длинный. Не раздувай объём.
- Для всей части предпочитай ОДИН доминирующий тип: radio ИЛИ gapFill — не смешивай без явной необходимости.
- matchPairs, wordOrder, checkbox — только если это явно следует из инструкции в материале.
- Строго соблюдай контракт формата, иначе задание будет отброшено:
  - radio: 2+ options с ключами A,B,C…; correctKey ДОЛЖЕН быть равен key одного из options.
  - gapFill: в gapTemplate ровно один маркер «___»; gapCorrectToken — слово для него.
- У каждого вопроса уникальный id.
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
    modelOptions: { role: 'spec', temperature: 0 },
    retries: 2,
  })
}
