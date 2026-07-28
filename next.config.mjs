import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Компактный self-hosted бандл для production (docker).
  output: 'standalone',
  // v2 — самодостаточный проект: трассируем от его каталога, иначе внешний
  // lockfile родительского репозитория ломает раскладку standalone (вложение в /v2).
  outputFileTracingRoot: __dirname,
  // pdfjs-dist не должен бандлиться — тянет нативные/воркерные ресурсы.
  serverExternalPackages: ['pdfjs-dist'],
  images: { unoptimized: true },
}

export default nextConfig
