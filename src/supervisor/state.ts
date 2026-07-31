import { Annotation, MessagesAnnotation } from '@langchain/langgraph'

import type { MaterialPart } from '@/src/agents/split-parts'

/** Состояние сессии генерации (сериализуется в checkpointer). */
export const GenerationStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  userId: Annotation<string>(),
  runId: Annotation<string>(),
  threadId: Annotation<string>(),

  title: Annotation<string>(),
  /** Исходный материал (текст + извлечённый из PDF). */
  material: Annotation<string>(),
  sourceType: Annotation<'pdf' | 'text'>({
    default: () => 'text',
    reducer: (left, right) => right ?? left,
  }),

  /** Выставляется узлом classify. */
  mode: Annotation<'ready_material' | 'raw_material'>({
    default: () => 'ready_material',
    reducer: (left, right) => right ?? left,
  }),

  correctAnswersHint: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),
  autoSolveRequested: Annotation<boolean>({ default: () => false, reducer: (left, right) => right ?? left }),

  materialRelevant: Annotation<boolean>({ default: () => true, reducer: (left, right) => right ?? left }),
  relevanceMessage: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),

  planDraft: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),

  parts: Annotation<MaterialPart[]>({ default: () => [], reducer: (left, right) => right ?? left }),

  /** JSON.stringify(LessonSpec) после сборки. */
  specJson: Annotation<string | null>({
    default: () => null,
    reducer: (left, right) => (right === undefined ? left : right),
  }),
  validationWarnings: Annotation<string[]>({ default: () => [], reducer: (left, right) => right ?? left }),
  autoSolveDisclaimer: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),

  htmlBody: Annotation<string | null>({
    default: () => null,
    reducer: (left, right) => (right === undefined ? left : right),
  }),
  lessonId: Annotation<string | null>({
    default: () => null,
    reducer: (left, right) => (right === undefined ? left : right),
  }),

  phase: Annotation<string>({ default: () => 'init', reducer: (left, right) => right ?? left }),
  errorCode: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),
  errorMessage: Annotation<string>({ default: () => '', reducer: (left, right) => right ?? left }),
})

export type GenerationState = typeof GenerationStateAnnotation.State
