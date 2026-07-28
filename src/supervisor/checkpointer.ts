import { MemorySaver } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

import { env } from '@/src/config/env'

let memorySaver: MemorySaver | null = null
let postgresSaver: PostgresSaver | null = null

/**
 * Checkpointer LangGraph: Postgres (Supabase) при заданном connection string, иначе — in-memory.
 * In-memory не переживает перезапуск процесса — для локальных экспериментов без БД.
 */
export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  const connectionString = env.supabase.dbUrl()
  if (connectionString) {
    if (!postgresSaver) {
      postgresSaver = PostgresSaver.fromConnString(connectionString)
      await postgresSaver.setup()
    }
    return postgresSaver
  }
  memorySaver ??= new MemorySaver()
  return memorySaver
}
