import { z } from 'zod'

import { callStructured } from '@/src/llm/structured'
import type { LessonSpecFromModel } from '@/src/lesson-spec/schema'

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string().min(1).describe('id вопроса из спецификации'),
        answer: z
          .union([z.string(), z.array(z.string())])
          .describe('Правильный ответ: ключ варианта / слово / предложение; массив — для нескольких пропусков, checkbox или matchPairs'),
      }),
    )
    .describe('Правильные ответы для всех вопросов'),
})

const SYSTEM = `Ты решаешь тест: по материалу определяешь правильные ответы для каждого вопроса.

Для каждого id верни answer:
- radio/select: буква верного варианта (например "B").
- checkbox: массив букв (["A","C"]).
- gapFill/gapDrag: слово в пропуск; для нескольких пропусков — массив слов слева направо.
- wordOrder: правильное предложение целиком.
- matchPairs: массив ключей right по порядку matchLeftItems.

Отвечай строго по материалу. Не пропускай вопросы.`

function applyAnswer(
  question: Record<string, unknown>,
  inputKind: string,
  answer: string | string[],
): void {
  const asArray = Array.isArray(answer) ? answer : [answer]
  switch (inputKind) {
    case 'checkbox':
      question.correctKeys = asArray
      break
    case 'gapFill':
    case 'gapDrag':
      if (asArray.length > 1) question.gapCorrectTokens = asArray
      else question.gapCorrectToken = asArray[0]
      break
    case 'wordOrder':
      question.correctSentence = String(answer)
      break
    case 'matchPairs':
      question.matchCorrectKeys = asArray
      break
    default:
      question.correctKey = String(Array.isArray(answer) ? answer[0] : answer)
  }
}

/** Заполняет правильные ответы в спецификации моделью (по материалу). Не меняет формулировки. */
export async function solveAnswers(input: {
  spec: LessonSpecFromModel
  material: string
}): Promise<{ spec: LessonSpecFromModel; disclaimer: string }> {
  const summary = input.spec.parts.flatMap((part) =>
    part.exercises.flatMap((ex) =>
      ex.questions.map((q) => ({ id: q.id, inputKind: ex.inputKind ?? 'radio', prompt: q.prompt, options: q.options })),
    ),
  )

  const user = [
    '### Вопросы теста (JSON)',
    JSON.stringify(summary, null, 2).slice(0, 40_000),
    '',
    '### Материал',
    input.material.trim().slice(0, 40_000),
  ].join('\n')

  const { answers } = await callStructured({
    system: SYSTEM,
    user,
    schema: answersSchema,
    schemaName: 'lesson_answers',
    modelOptions: { role: 'spec', temperature: 0 },
    retries: 1,
  })

  const byId = new Map(answers.map((a) => [a.id, a.answer]))
  const next = structuredClone(input.spec) as LessonSpecFromModel
  for (const part of next.parts) {
    for (const ex of part.exercises) {
      const kind = ex.inputKind ?? 'radio'
      for (const q of ex.questions) {
        const answer = byId.get(q.id)
        if (answer !== undefined) applyAnswer(q as unknown as Record<string, unknown>, kind, answer)
      }
    }
  }

  return {
    spec: next,
    disclaimer: 'Ответы определены моделью автоматически — точность не гарантируется, проверьте ключи.',
  }
}
