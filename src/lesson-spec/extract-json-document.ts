const MAX_JSON_BYTES = 400_000

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function extractFromFullStringFence(trimmed: string): string | null {
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(trimmed)
  const inner = fence?.[1]?.trim()
  return inner && inner.length > 0 ? inner : null
}

/** Первый блок ```json ... ``` / ``` ... ``` в тексте, если внутри похоже на JSON. */
function extractFromAnyFence(source: string): string | null {
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = fencePattern.exec(source)) !== null) {
    const inner = match[1]?.trim()
    if (inner && (inner.startsWith('{') || inner.startsWith('['))) {
      return inner
    }
  }
  return null
}

function sliceBalancedFromDelimiter(
  source: string,
  openChar: string,
  closeChar: string,
): string | null {
  const start = source.indexOf(openChar)
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escapeNext = false
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === openChar) depth++
    else if (char === closeChar) {
      depth--
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return null
}

/** Объект или массив с первой позиции, где встретился открывающий символ сбалансированной структуры. */
function sliceBalancedJsonContainer(source: string): string | null {
  const objectSlice = sliceBalancedFromDelimiter(source, '{', '}')
  if (objectSlice) return objectSlice
  return sliceBalancedFromDelimiter(source, '[', ']')
}

/**
 * Убирает markdown-ограждение ```json, извлекает первый JSON-объект/массив из «шумного» ответа модели, проверяет размер.
 */
export function extractJsonDocument(raw: string): string {
  let candidate = stripBom(raw).trim()

  const fullFence = extractFromFullStringFence(candidate)
  if (fullFence) {
    candidate = fullFence
  } else {
    const anyFence = extractFromAnyFence(candidate)
    if (anyFence) {
      candidate = anyFence
    } else {
      const balanced = sliceBalancedJsonContainer(candidate)
      if (balanced) candidate = balanced
    }
  }

  const enc = new TextEncoder().encode(candidate)
  if (enc.length > MAX_JSON_BYTES) {
    throw new Error('Сгенерированный JSON слишком большой')
  }
  return candidate
}
