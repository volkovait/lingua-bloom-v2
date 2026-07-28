import type { LessonSpec } from '@/src/lesson-spec/schema'

import { LESSON_CSS } from './lesson-style'

export const DEFAULT_LESSON_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap'

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Встраивает JSON в HTML без преждевременного закрытия тега script. */
function embedLessonSpecJson(spec: LessonSpec): string {
  return JSON.stringify(spec).replace(/</g, '\\u003c')
}

/**
 * Собирает HTML-документ теста: инлайн CSS, JSON-спека, внешний /lesson-runtime.js.
 * CSS встроен как строковая константа (см. lesson-style.ts) — надёжно для standalone-сборки.
 */
export function buildLessonHtmlFromSpec(spec: LessonSpec): string {
  const fontsHref = spec.googleFontsHref ?? DEFAULT_LESSON_FONTS_HREF
  const specJson = embedLessonSpecJson(spec)
  const title = escapeHtmlAttr(spec.title)
  const subtitleBlock = spec.subtitle
    ? `<p>${escapeHtmlText(spec.subtitle)}</p>`
    : '<p>Интерактивный тест с автоматической проверкой ответов</p>'

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${escapeHtmlAttr(fontsHref)}" />
  <style>
${LESSON_CSS}
  </style>
</head>
<body>
  <div class="page">
    <header class="intro">
      <h1>${escapeHtmlText(spec.title)}</h1>
      ${subtitleBlock}
      <label class="student-label" for="student-name">ФИО студента</label>
      <input class="student-name" type="text" id="student-name" name="student_name" autocomplete="name" placeholder="Например, Иванова Мария Сергеевна" />
    </header>
    <div id="test-root" class="test-root" role="main"></div>
    <div class="actions">
      <button type="button" id="finish-btn">Завершить тест и показать результаты</button>
    </div>
    <section class="result-panel" id="result-panel" aria-live="polite">
      <h3>Итог</h3>
      <p class="score" id="score-line"></p>
    </section>
  </div>
  <script id="lesson-spec" type="application/json">${specJson}</script>
  <script src="/lesson-runtime.js"></script>
</body>
</html>`
}
