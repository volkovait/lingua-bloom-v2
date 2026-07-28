/**
 * Правит частые ошибки в сохранённом HTML урока перед отдачей в строгом CSP-iframe.
 */
export function sanitizeLessonHtmlForDelivery(html: string): string {
  // Шрифты, ошибочно подключённые как внешние скрипты (ломает script-src, CSS не применяется).
  return html.replace(
    /<script\b[^>]*\bsrc=["'][^"']*(?:googleapis\.com|gstatic\.com)[^"']*["'][^>]*>\s*<\/script>/gi,
    '',
  )
}
