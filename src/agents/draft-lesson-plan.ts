import { createModel } from '@/src/llm/model'

const SYSTEM = `Ты методист. По сырому материалу составь краткий план урока в Markdown.

Структура:
- **Тема и цель урока**
- **Целевая аудитория/уровень** (если понятно из материала)
- **Логические блоки** (3–6 пунктов): для каждого — что изучаем и как проверим понимание (кратко, без перечисления всех возможных форматов).

Пиши по-русски, лаконично, без воды. Только план — без готовых заданий.`

/** Черновик плана урока по сырому материалу (Markdown). */
export async function draftLessonPlan(input: { title: string; material: string }): Promise<string> {
  const model = createModel({ role: 'plan', temperature: 0.3, maxTokens: 2048 })
  const user = [
    `Тема/название: ${input.title.trim() || '(не указано)'}`,
    '',
    '### Материал',
    input.material.trim().slice(0, 48_000),
  ].join('\n')

  const response = await model.invoke([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ])

  const content = typeof response.content === 'string' ? response.content : String(response.content)
  return content.trim()
}
