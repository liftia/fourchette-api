import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type Dataset = 'service' | 'empty'

const root = join(import.meta.dirname, '..')

function runFile(db: DatabaseSync, file: string): void {
  const path = join(root, file)
  if (existsSync(path)) db.exec(readFileSync(path, 'utf8'))
}

export function openDb(dataset: Dataset): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  runFile(db, 'src/schema.sql')
  runFile(db, 'data/menu.sql')
  if (dataset === 'service') runFile(db, 'data/service.sql')
  return db
}
