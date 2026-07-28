import { HumanMessage, SystemMessage } from '@langchain/core/messages'

import { createModel } from '@/src/llm/model'

const SYSTEM = `Ты методист. По сырому материалу составь краткий план урока в Markdown.

Структура:
- **Тема и цель урока**
- **Целевая аудитория/уровень** (если понятно из материала)
- **Логические блоки** (3–6 пунктов): для каждого — что изучаем и какой тип проверки подойдёт (выбор варианта, пропуски, сопоставление, порядок слов).

Пиши по-русски, лаконично, без воды. Только план — без готовых заданий.`

/** Черновик плана урока (Markdown) по сырому материалу. */
export async function draftLessonPlan(input: { title: string; material: string }): Promise<string> {
  const model = createModel({ role: 'plan', temperature: 0.3 })
  const user = [
    `Название/тема: ${input.title.trim() || '(не указано)'}`,
    '',
    '### Сырой материал',
    input.material.trim().slice(0, 56_000),
  ].join('\n')

  const response = await model.invoke([new SystemMessage(SYSTEM), new HumanMessage(user)])
  const content = typeof response.content === 'string' ? response.content : String(response.content)
  const plan = content.trim()
  if (!plan) throw new Error('Модель вернула пустой план урока.')
  return plan
}
