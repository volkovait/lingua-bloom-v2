import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { extractCandidates } from './candidates'
import { extractPdfText } from './pdf'

const DATA_DIR = path.resolve(process.cwd(), 'tesing-data')

function readPdf(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(DATA_DIR, name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('extractPdfText (реальные PDF из tesing-data)', () => {
  it('извлекает текст grammar-теста и находит готовые задания', async () => {
    const text = await extractPdfText(readPdf('1_page.pdf'))
    expect(text.length).toBeGreaterThan(500)
    expect(text).toContain('PROGRESS TEST')
    expect(text.toLowerCase()).toContain('choose the correct answer')

    const { candidates, hasReadyExercises } = extractCandidates(text)
    expect(hasReadyExercises).toBe(true)
    expect(candidates.length).toBeGreaterThan(3)
  })

  it('извлекает текст reading/tasks-PDF и находит готовые задания', async () => {
    const text = await extractPdfText(readPdf('text_for_reading_and_tasks.pdf'))
    expect(text.length).toBeGreaterThan(300)
    expect(text.toLowerCase()).toContain('match the sentence halves')

    const { hasReadyExercises } = extractCandidates(text)
    expect(hasReadyExercises).toBe(true)
  })
})
