/** Тип задания, распознанный детерминированным парсером. */
export type CandidateKind = 'mcq' | 'trueFalse' | 'gap' | 'bracketGap'

export type CandidateOption = {
  /** Исходная метка варианта (A/B/1/…), как встретилась в тексте. */
  label: string
  text: string
}

/** Один кандидат-вопрос, извлечённый из исходного текста (без «додумывания»). */
export type ExtractedCandidate = {
  kind: CandidateKind
  /** Формулировка вопроса/утверждения (для gap — предложение с ___). */
  prompt: string
  /** Варианты для mcq (для trueFalse/gap может быть пусто). */
  options: CandidateOption[]
  /**
   * Правильный ответ, если он ЯВНО присутствует в источнике (ключ/метка или true/false).
   * Для bracketGap — базовая форма из скобки (например «study», «not drink»).
   * null — ответа в источнике нет.
   */
  answer: string | null
  /** Смещение в исходном тексте (для сортировки/дебага). */
  sourceIndex: number
}

export type ExtractionResult = {
  candidates: ExtractedCandidate[]
  hasReadyExercises: boolean
}
