/** Тип задания, распознанный детерминированным парсером. */
export type CandidateKind = 'mcq' | 'trueFalse' | 'gap'

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
   * null — ответа в источнике нет (его нужно будет получить от пользователя или solve-агента).
   */
  answer: string | null
  /** Смещение в исходном тексте (для сортировки/дебага). */
  sourceIndex: number
}

export type ExtractionResult = {
  candidates: ExtractedCandidate[]
  /** Доля покрытия: сколько распознано относительно эвристической оценки числа вопросов. */
  hasReadyExercises: boolean
}
