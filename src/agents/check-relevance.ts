import { z } from 'zod'

import { callStructured } from '@/src/llm/structured'

const schema = z.object({
  relevant: z.boolean().describe('Подходит ли материал под критерии сценария'),
  userMessage: z
    .string()
    .max(1200)
    .describe('Короткое объяснение на русском (при relevant=false — вежливая причина отказа)'),
})

export type RelevanceScope = 'raw_for_lesson_planning' | 'ready_for_interactive_tests'

const READY_SYSTEM = `Ты проверяешь материал перед генерацией интерактивных тестов.

relevant=true, если из материала можно составить проверяемые задания:
- готовые тесты/вопросы с вариантами;
- учебный текст/лексика/грамматика с явными фактами;
- конспекты/статьи с формулировками для теста;
- текст для чтения + явная просьба составить по нему тест.

relevant=false для: случайного текста (погода, реклама, переписка), списков ссылок без содержания, пустого шума.
При relevant=false — вежливо объясни на русском без технических терминов.`

const RAW_SYSTEM = `Ты проверяешь СЫРОЙ материал перед планированием урока.

relevant=true, если из текста реально можно спланировать учебный блок (темы, цели, последовательность), даже если формулировки сырые.
relevant=false, если контент не позволяет педагогически осмысленно спланировать занятие (шум, спам, полный оффтоп).
При relevant=false — кратко на русском.`

export async function checkRelevance(input: {
  scope: RelevanceScope
  title: string
  material: string
}): Promise<{ relevant: boolean; userMessage: string }> {
  const system = input.scope === 'raw_for_lesson_planning' ? RAW_SYSTEM : READY_SYSTEM
  const user = [
    `Название/тема: ${input.title.trim() || '(не указано)'}`,
    '',
    '### Материал',
    input.material.trim().slice(0, 48_000),
  ].join('\n')

  try {
    return await callStructured({
      system,
      user,
      schema,
      schemaName: 'material_relevance',
      modelOptions: { role: 'classify', temperature: 0 },
    })
  } catch {
    return {
      relevant: false,
      userMessage: 'Не удалось оценить материал. Попробуйте другой файл или более подробное описание.',
    }
  }
}
