import { Annotation } from '@langchain/langgraph'

import type { MaterialPart } from '@/src/agents/split-parts'

/** Состояние сессии генерации (сериализуется в checkpointer). */
export const GenerationStateAnnotation = Annotation.Root({
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

  correctAnswersHint: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),
  autoSolveRequested: Annotation<boolean>({ default: () => false, reducer: (l, r) => r ?? l }),

  materialRelevant: Annotation<boolean>({ default: () => true, reducer: (l, r) => r ?? l }),
  relevanceMessage: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),

  planDraft: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),

  parts: Annotation<MaterialPart[]>({ default: () => [], reducer: (l, r) => r ?? l }),

  /** JSON.stringify(LessonSpec) после сборки. */
  specJson: Annotation<string | null>({ default: () => null, reducer: (l, r) => (r === undefined ? l : r) }),
  validationWarnings: Annotation<string[]>({ default: () => [], reducer: (l, r) => r ?? l }),
  autoSolveDisclaimer: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),

  htmlBody: Annotation<string | null>({ default: () => null, reducer: (l, r) => (r === undefined ? l : r) }),
  lessonId: Annotation<string | null>({ default: () => null, reducer: (l, r) => (r === undefined ? l : r) }),

  phase: Annotation<string>({ default: () => 'init', reducer: (l, r) => r ?? l }),
  errorCode: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),
  errorMessage: Annotation<string>({ default: () => '', reducer: (l, r) => r ?? l }),
})

export type GenerationState = typeof GenerationStateAnnotation.State
