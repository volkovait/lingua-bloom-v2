import { z } from 'zod'

import { callStructured } from '@/src/llm/structured'

const schema = z.object({
  parts: z
    .array(
      z.object({
        title: z.string().min(1).max(300).describe('Короткое название логической части'),
        text: z.string().min(1).max(20000).describe('Дословный фрагмент материала для этой части'),
      }),
    )
    .min(1)
    .max(12)
    .describe('Логические части материала по порядку'),
})

export type MaterialPart = { title: string; text: string }

const SYSTEM = `Ты разбиваешь учебный материал на логические части для последующей сборки теста.

Правила:
- Сохраняй ТЕКСТ дословно — не переписывай и не сокращай содержание, только группируй.
- Каждая часть = один связный смысловой блок (тема/упражнение/раздел).
- 1–12 частей. Если материал короткий и однородный — верни одну часть.
- Не выдумывай новый контент.`

/** Разбивает материал на логические части (дословно, без переписывания). */
export async function splitMaterialIntoParts(input: {
  title: string
  material: string
}): Promise<MaterialPart[]> {
  const material = input.material.trim()
  // Короткий материал не дробим — экономим вызов модели.
  if (material.length < 800) {
    return [{ title: input.title.trim() || 'Материал', text: material }]
  }

  const user = [
    `Название/тема: ${input.title.trim() || '(не указано)'}`,
    '',
    '### Материал',
    material.slice(0, 90_000),
  ].join('\n')

  try {
    const { parts } = await callStructured({
      system: SYSTEM,
      user,
      schema,
      schemaName: 'material_parts',
      modelOptions: { role: 'default', temperature: 0 },
    })
    const cleaned = parts.map((p) => ({ title: p.title.trim(), text: p.text.trim() })).filter((p) => p.text)
    return cleaned.length > 0 ? cleaned : [{ title: input.title.trim() || 'Материал', text: material }]
  } catch {
    return [{ title: input.title.trim() || 'Материал', text: material }]
  }
}
