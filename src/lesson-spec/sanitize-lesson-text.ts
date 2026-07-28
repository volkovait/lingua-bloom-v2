/**
 * Убирает HTML-теги и типичные сущности, чтобы вопросы и варианты были обычным текстом.
 */
export function stripHtmlTags(input: string): string {
  let s = input.replace(/<[^>]*>/g, '')
  s = s.replace(/&nbsp;/gi, ' ')
  s = s.replace(/&amp;/g, '&')
  s = s.replace(/&lt;/g, '<')
  s = s.replace(/&gt;/g, '>')
  s = s.replace(/&#39;/g, "'")
  s = s.replace(/&quot;/g, '"')
  s = s.replace(/[ \t]+\n/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  s = s.replace(/[ \t]{2,}/g, ' ')
  return s.trim()
}
