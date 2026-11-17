import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { API_DIR } from './processes.ts'

export const MISSING =
  'Pas encore de filet ici : il arrive au débrief.\nRécupérez-le avec : npm run acceptance:fetch -- challenge-1'

async function main(args: string[]): Promise<number> {
  const runner = join(API_DIR, 'acceptance', 'acceptance.ts')
  if (!existsSync(runner)) {
    console.error(MISSING)
    return 2
  }
  const child = spawn(process.execPath, [runner, ...args], { cwd: API_DIR, stdio: 'inherit' })
  // Ctrl+C atteint aussi le filet, qui arrête son API : on attend sa fin au lieu de mourir avant lui.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {})
  return new Promise((done) => {
    child.once('error', (error) => {
      console.error(error.message)
      done(2)
    })
    child.once('close', (code) => done(code ?? 1))
  })
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
