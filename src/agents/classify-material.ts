import { z } from 'zod'

import { callStructured } from '@/src/llm/structured'

const schema = z.object({
  pipeline: z
    .enum(['ready_for_tests', 'needs_lesson_planning'])
    .describe(
      'ready_for_tests — материал уже пригоден для проверяемых заданий (готовые вопросы/тесты/упражнения или плотный учебный текст с фактами). needs_lesson_planning — сырой/разрозненный материал (наброски, лекции без заданий, списки тем), где сначала разумен план урока.',
    ),
})

export type MaterialMode = 'ready_material' | 'raw_material'

const SYSTEM = `Ты классифицируешь ввод пользователя для генерации интерактивного теста. Выбери ровно одно значение pipeline.

- ready_for_tests — есть готовые вопросы/тесты/упражнения с вариантами ИЛИ плотный учебный текст с фактами, из которого можно сразу собрать тест.
- needs_lesson_planning — материал сырой или разрозненный: наброски, лекции без заданий, списки тем, общий конспект.

Не проси уточнений — только классификация по тексту.`

/** Классифицирует материал: нужен ли сначала план урока (raw) или можно сразу к тесту (ready). */
export async function classifyMaterial(input: {
  title: string
  material: string
}): Promise<MaterialMode> {
  const user = [
    `Название/тема (если есть): ${input.title.trim() || '(не указано)'}`,
    '',
    '### Ввод пользователя',
    input.material.trim().slice(0, 56_000),
  ].join('\n')

  const { pipeline } = await callStructured({
    system: SYSTEM,
    user,
    schema,
    schemaName: 'lesson_material_pipeline',
    modelOptions: { role: 'classify', temperature: 0 },
  })
  return pipeline === 'needs_lesson_planning' ? 'raw_material' : 'ready_material'
}
