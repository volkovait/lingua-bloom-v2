/**
 * Детерминированное извлечение текста из PDF через pdfjs-dist (legacy build, без DOM).
 * Воркер резолвится по абсолютному file:-URL — иначе ломается под Next standalone.
 */

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsReady: Promise<Pdfjs> | undefined

async function loadPdfjs(): Promise<Pdfjs> {
  pdfjsReady ??= (async () => {
    const [{ createRequire }, { pathToFileURL }, pdfjs] = await Promise.all([
      import('node:module'),
      import('node:url'),
      import('pdfjs-dist/legacy/build/pdf.mjs'),
    ])
    const require = createRequire(import.meta.url)
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
    return pdfjs
  })()
  return pdfjsReady
}

const DEFAULT_MAX_CHARS = 60_000

/** Возвращает текст PDF с переносами строк по страницам (пустая строка между страницами). */
export async function extractPdfText(
  buffer: ArrayBuffer,
  maxChars = DEFAULT_MAX_CHARS,
): Promise<string> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines: string[] = []
    let current = ''
    for (const item of content.items) {
      if (!('str' in item) || typeof item.str !== 'string') continue
      current += item.str
      if ('hasEOL' in item && item.hasEOL) {
        lines.push(current.trimEnd())
        current = ''
      } else {
        current += ' '
      }
    }
    if (current.trim().length > 0) lines.push(current.trimEnd())
    pages.push(lines.join('\n'))
    page.cleanup()
  }
  await doc.destroy()

  const text = pages
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, maxChars)
}
