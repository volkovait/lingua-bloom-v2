import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Загружает .env / .env.local в process.env для тестов (vitest не делает это сам).
 * Не перезаписывает уже заданные переменные.
 */
function loadEnvFile(file: string): void {
  const full = path.resolve(process.cwd(), file)
  if (!existsSync(full)) return
  const raw = readFileSync(full, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')
