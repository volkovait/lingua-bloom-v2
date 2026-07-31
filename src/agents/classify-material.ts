import { z } from 'zod'

import { resolveMaterialIntent, type MaterialIntent } from '@/src/extract/detect-intent'
import { callStructured } from '@/src/llm/structured'

const schema = z.object({
  pipeline: z
    .enum(['ready_for_tests', 'needs_lesson_planning'])
    .describe(
      'ready_for_tests — материал уже пригоден для проверяемых заданий (готовые вопросы/тесты/упражнения или плотный учебный текст с фактами). needs_lesson_planning — сырой/разрозненный материал (наброски, лекции без заданий, списки тем), где сначала разумен план урока.',
    ),
  intent: z
    .enum(['reproduce_test', 'generate_from_content'])
    .describe(
      'reproduce_test — в материале уже есть готовые задания (нумерация, варианты, пропуски, «раскройте скобки»). generate_from_content — плотный текст без готовых формулировок, из которого нужно составить новые вопросы.',
    ),
})

export type MaterialMode = 'ready_material' | 'raw_material'
export type { MaterialIntent }

const SYSTEM = `Ты классифицируешь ввод пользователя для генерации интерактивного теста. Выбери pipeline и intent.

pipeline:
- ready_for_tests — есть готовые вопросы/тесты/упражнения с вариантами ИЛИ плотный учебный текст с фактами, из которого можно сразу собрать тест.
- needs_lesson_planning — материал сырой или разрозненный: наброски, лекции без заданий, списки тем, общий конспект.

intent:
- reproduce_test — явные готовые задания: нумерованные пункты, варианты ответа, пропуски ___, скобки (to study), «раскройте скобки», «выберите правильный», «упражнение N».
- generate_from_content — учебный текст/статья без готовых формулировок заданий; нужно придумать вопросы по содержанию.

Не проси уточнений — только классификация по тексту.`

export type ClassifyMaterialResult = {
  mode: MaterialMode
  materialIntent: MaterialIntent
}

/** Классифицирует материал: pipeline (raw vs ready) и intent (reproduce vs generate). */
export async function classifyMaterial(input: {
  title: string
  material: string
}): Promise<ClassifyMaterialResult> {
  const user = [
    `Название/тема (если есть): ${input.title.trim() || '(не указано)'}`,
    '',
    '### Ввод пользователя',
    input.material.trim().slice(0, 56_000),
  ].join('\n')

  const { pipeline, intent } = await callStructured({
    system: SYSTEM,
    user,
    schema,
    schemaName: 'lesson_material_pipeline',
    modelOptions: { role: 'classify', temperature: 0 },
  })

  const mode: MaterialMode = pipeline === 'needs_lesson_planning' ? 'raw_material' : 'ready_material'
  const materialIntent = resolveMaterialIntent(intent, input.material, input.title)

  return { mode, materialIntent }
}
