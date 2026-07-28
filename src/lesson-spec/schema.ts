import { z } from 'zod'

export const LESSON_SPEC_VERSION = 1 as const

function gapMarkerCount(template: string): number {
  if (!template.includes('___')) return 0
  return template.split('___').length - 1
}

function multisetContainsEveryToken(bank: readonly string[], tokens: readonly string[]): boolean {
  const available = new Map<string, number>()
  for (const word of bank) {
    available.set(word, (available.get(word) ?? 0) + 1)
  }
  for (const token of tokens) {
    const next = (available.get(token) ?? 0) - 1
    if (next < 0) return false
    available.set(token, next)
  }
  return true
}

const optionSchema = z.object({
  key: z.string().min(1).max(8),
  text: z.string().min(1).max(2000),
})

export const readingPassageSchema = z.object({
  title: z.string().max(300).optional(),
  instruction: z.string().max(2000).optional(),
  paragraphs: z.array(z.string().min(1).max(12000)).min(1).max(40),
})

const exerciseInputKindSchema = z.enum([
  'radio',
  'select',
  'checkbox',
  'wordOrder',
  'gapFill',
  'gapDrag',
  'matchPairs',
])

export const questionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(4000),
  options: z.array(optionSchema).optional(),
  /** До normalize допускаем длинный ответ (текст варианта); потом сжимается к A/B/… */
  correctKey: z.string().min(1).max(2000).optional(),
  /** Множественный выбор: набор ключей вариантов (после normalize — буквы A, B, …) */
  correctKeys: z.array(z.string().min(1).max(80)).min(1).max(20).optional(),
  wordBank: z.array(z.string().min(1).max(200)).max(40).optional(),
  correctSentence: z.string().min(1).max(2000).optional(),
  /** Шаблон с маркерами пропуска «___» для gapFill / gapDrag (один или несколько пропусков в одном предложении/диалоге) */
  gapTemplate: z.string().min(1).max(4000).optional(),
  /** Одно слово для gapTemplate с ровно одним «___» (gapFill — свободный ввод; gapDrag — из wordBank) */
  gapCorrectToken: z.string().min(1).max(200).optional(),
  /** Слова по порядку слева направо для каждого «___» в gapTemplate (несколько пропусков) */
  gapCorrectTokens: z.array(z.string().min(1).max(200)).max(40).optional(),
  /** Сопоставление (matchPairs): левая колонка (начала фраз), фиксированный порядок */
  matchLeftItems: z.array(z.string().min(1).max(2000)).max(40).optional(),
  /** Правая колонка: варианты с ключами A, B, C… (перетаскиваются в слоты слева) */
  matchRightOptions: z.array(optionSchema).max(40).optional(),
  /** Для каждого элемента matchLeftItems — ключ верного варианта из matchRightOptions */
  matchCorrectKeys: z.array(z.string().min(1).max(8)).max(40).optional(),
})

export const exerciseSchema = z.object({
  title: z.string().min(1).max(500),
  instruction: z.string().max(4000).optional(),
  /** Показать блок-заглушку «аудио» без реального файла на сервере */
  audio: z.boolean().optional(),
  inputKind: exerciseInputKindSchema.optional().default('radio'),
  readingPassage: readingPassageSchema.optional(),
  questions: z.array(questionSchema).min(1).max(80),
})

export const partSchema = z.object({
  title: z.string().min(1).max(500),
  exercises: z.array(exerciseSchema).min(1).max(40),
})

export type LessonExercise = z.infer<typeof exerciseSchema>
export type LessonPart = z.infer<typeof partSchema>

/** Поля, которые заполняет сервер после валидации модели */
export const lessonRuntimeSchema = z.object({
  localStorageKey: z.string().min(8).max(120),
})

/** То, что ожидается от модели (без runtime) */
export const lessonSpecFromModelSchema = z
  .object({
    version: z.literal(LESSON_SPEC_VERSION),
    title: z.string().min(1).max(500),
    subtitle: z.string().max(1000).optional(),
    /** Только Google Fonts CSS2 link, см. промпт */
    googleFontsHref: z
      .string()
      .url()
      .max(2000)
      .optional()
      .refine(
        (u) => u === undefined || /^https:\/\/fonts\.googleapis\.com\/css2/i.test(u),
        'googleFontsHref must be fonts.googleapis.com/css2 when set',
      ),
    parts: z.array(partSchema).min(1).max(30),
  })
  .superRefine((data, ctx) => {
    let qCount = 0
    for (let pi = 0; pi < data.parts.length; pi += 1) {
      const part = data.parts[pi]
      for (let ei = 0; ei < part.exercises.length; ei += 1) {
        const ex = part.exercises[ei]
        const kind = ex.inputKind ?? 'radio'
        for (let qi = 0; qi < ex.questions.length; qi += 1) {
          const q = ex.questions[qi]
          const qPath = ['parts', pi, 'exercises', ei, 'questions', qi] as const
          qCount += 1
          if (qCount > 200) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Слишком много вопросов (макс. 200)',
              path: ['parts'],
            })
            return
          }
          if (kind === 'wordOrder') {
            const bank = q.wordBank
            if (!bank || bank.length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для wordOrder нужен wordBank из минимум 2 слов',
                path: [...qPath, 'wordBank'],
              })
            }
            if (!q.correctSentence?.trim()) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для wordOrder нужен correctSentence',
                path: [...qPath, 'correctSentence'],
              })
            }
          } else if (kind === 'gapFill' || kind === 'gapDrag') {
            const requiresWordBank = kind === 'gapDrag'
            const bank = q.wordBank
            if (requiresWordBank && (!bank || bank.length < 2)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для gapDrag нужен wordBank из минимум 2 слов',
                path: [...qPath, 'wordBank'],
              })
            }
            const template = q.gapTemplate?.trim() ?? ''
            if (!template.includes('___')) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Для ${kind} в gapTemplate должен быть хотя бы один маркер пропуска ___`,
                path: [...qPath, 'gapTemplate'],
              })
            }
            const gaps = gapMarkerCount(template)
            if (gaps === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Не удалось разобрать пропуски ___ в gapTemplate',
                path: [...qPath, 'gapTemplate'],
              })
            } else if (gaps === 1) {
              if (q.gapCorrectTokens && q.gapCorrectTokens.length > 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    'Для одного пропуска задайте либо gapCorrectToken, либо массив gapCorrectTokens из ровно одного элемента',
                  path: [...qPath, 'gapCorrectTokens'],
                })
              }
              const fromArray = q.gapCorrectTokens
              let token = ''
              if (fromArray && fromArray.length === 1) {
                token = fromArray[0]?.trim() ?? ''
              }
              if (!token) {
                token = q.gapCorrectToken?.trim() ?? ''
              }
              if (!token) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Для ${kind} с одним пропуском нужен gapCorrectToken или gapCorrectTokens из одного элемента`,
                  path: [...qPath, 'gapCorrectToken'],
                })
              } else if (requiresWordBank && bank && !multisetContainsEveryToken(bank, [token])) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'gapCorrectToken должен встречаться в wordBank (с учётом повторов)',
                  path: [...qPath, 'gapCorrectToken'],
                })
              }
            } else {
              const picks = q.gapCorrectTokens
              if (!picks || picks.length !== gaps) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    `Для ${kind} с ${String(gaps)} пропусками нужен gapCorrectTokens длиной ${String(gaps)} (порядок слева направо)`,
                  path: [...qPath, 'gapCorrectTokens'],
                })
              } else if (requiresWordBank && bank && !multisetContainsEveryToken(bank, picks)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'Каждый элемент gapCorrectTokens должен быть взят из wordBank (мульти-множество)',
                  path: [...qPath, 'gapCorrectTokens'],
                })
              }
            }
          } else if (kind === 'matchPairs') {
            const leftItems = q.matchLeftItems ?? []
            const rightOpts = q.matchRightOptions ?? []
            const corr = q.matchCorrectKeys ?? []
            if (leftItems.length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для matchPairs нужно минимум 2 строки в matchLeftItems',
                path: [...qPath, 'matchLeftItems'],
              })
            }
            if (rightOpts.length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для matchPairs нужно минимум 2 варианта в matchRightOptions',
                path: [...qPath, 'matchRightOptions'],
              })
            }
            if (corr.length !== leftItems.length || leftItems.length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Длина matchCorrectKeys должна совпадать с числом matchLeftItems',
                path: [...qPath, 'matchCorrectKeys'],
              })
            }
            for (let ck = 0; ck < corr.length; ck += 1) {
              const want = corr[ck]?.trim() ?? ''
              if (!want) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'matchCorrectKeys не должен содержать пустых значений',
                  path: [...qPath, 'matchCorrectKeys'],
                })
                continue
              }
              const resolvedKey = rightOpts.some(
                (optionRow) => optionRow.key === want || optionRow.text.trim().toLowerCase() === want.toLowerCase(),
              )
              if (!resolvedKey) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `matchCorrectKeys[${String(ck)}]="${want}" не соответствует ни одному ключу/text в matchRightOptions`,
                  path: [...qPath, 'matchCorrectKeys'],
                })
              }
            }
          } else if (kind === 'checkbox') {
            const opts = q.options
            if (!opts || opts.length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для checkbox нужны options (минимум 2)',
                path: [...qPath, 'options'],
              })
            }
            const keys = q.correctKeys
            if (!keys || keys.length < 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для checkbox нужен correctKeys (минимум 1 ключ)',
                path: [...qPath, 'correctKeys'],
              })
            } else if (opts) {
              for (const key of keys) {
                if (!opts.some((o) => o.key === key || o.text.trim().toLowerCase() === key.trim().toLowerCase())) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `correctKeys содержит неизвестный ключ "${key}"`,
                    path: [...qPath, 'correctKeys'],
                  })
                }
              }
            }
          } else {
            const opts = q.options
            if (!opts || opts.length < 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Для radio/select нужны options (минимум 2)',
                path: [...qPath, 'options'],
              })
            }
            const ck = q.correctKey
            if (!ck) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Нужен correctKey',
                path: [...qPath, 'correctKey'],
              })
            } else if (
              opts &&
              !opts.some(
                (o) =>
                  o.key === ck ||
                  o.text.trim().toLowerCase() === ck.trim().toLowerCase(),
              )
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `correctKey "${ck}" не совпадает ни с одним key или text в options`,
                path: [...qPath, 'correctKey'],
              })
            }
          }
        }
      }
    }
  })

export const lessonSpecSchema = lessonSpecFromModelSchema.and(
  z.object({
    runtime: lessonRuntimeSchema,
  }),
)

export type LessonSpecFromModel = z.infer<typeof lessonSpecFromModelSchema>
export type LessonSpec = z.infer<typeof lessonSpecSchema>
