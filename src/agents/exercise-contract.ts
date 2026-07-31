import { z } from 'zod'

import { exerciseSchema } from '@/src/lesson-spec/schema'

/** Схема ответа для агентов, собирающих упражнения одной части урока. */
export const partExercisesSchema = z.object({
  exercises: z.array(exerciseSchema).min(1).max(20),
})

export type PartExercises = z.infer<typeof partExercisesSchema>

/** Описание контракта форматов заданий — общее для extract- и generate-агентов. */
export const EXERCISE_CONTRACT = `Каждое упражнение имеет inputKind и вопросы. Форматы (inputKind):

- "radio": один правильный вариант. Нужны options (2+, key A/B/C…) и correctKey (буква верного).
- "select": то же, что radio, но выпадающим списком.
- "checkbox": несколько правильных. Нужны options (2+) и correctKeys (массив букв).
- "gapFill": свободный ввод в пропуск. gapTemplate с «___»; один пропуск → gapCorrectToken; несколько → gapCorrectTokens (слева направо).
- "gapDrag": как gapFill, но слово перетаскивают из wordBank (в wordBank обязаны быть все правильные токены).
- "wordOrder": собрать предложение. wordBank (2+ слова) и correctSentence.
- "matchPairs": сопоставление. matchLeftItems (2+), matchRightOptions (2+, ключи A/B…), matchCorrectKeys (для каждого left — ключ right).

Требования:
- У каждого вопроса уникальный короткий id.
- Правильный ответ ОБЯЗАТЕЛЕН и должен соответствовать формату.
- Не смешивай форматы внутри одного упражнения — один inputKind на упражнение.
- Не смешивай inputKind между упражнениями без явного разделения в исходном материале.`
