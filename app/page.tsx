import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ChatRunWorkspace } from '@/components/chat-run-workspace'

export default function HomePage() {
  let defaultMaterialText = ''
  try {
    defaultMaterialText = readFileSync(join(process.cwd(), 'tesing-data', 'raw.txt'), 'utf8')
  } catch {
    defaultMaterialText = ''
  }

  return <ChatRunWorkspace defaultMaterialText={defaultMaterialText} />
}
