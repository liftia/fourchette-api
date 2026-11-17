import { API_DIR, findApps, start, stop } from './processes.ts'
import type { Running } from './processes.ts'

async function main(): Promise<number> {
  const found = findApps(API_DIR)
  if ('missing' in found) {
    console.error(`Dépôt introuvable à côté de l'API : ${found.missing.join(', ')}`)
    console.error('Clonez fourchette-pos et fourchette-kitchen dans le même dossier que fourchette-api.')
    return 2
  }
  const width = Math.max(...found.apps.map((app) => app.name.length))
  const all: Running[] = found.apps.map((app) =>
    start(app, (line) => console.log(`[${app.name.padEnd(width)}] ${line}`)),
  )
  let stopping = false
  const stopAll = async (): Promise<void> => {
    stopping = true
    await Promise.all(all.map(stop))
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      void stopAll().then(() => process.exit(130))
    })
  }
  console.log(`API http://localhost:3000 · caisse http://localhost:5174 · cuisine http://localhost:5173 · Ctrl+C pour tout arrêter`)
  const first = await Promise.race(all.map((running) => running.finished.then((code) => ({ running, code }))))
  if (stopping) return 130
  console.error(`[${first.running.app.name}] arrêté (code ${first.code ?? '?'}) : arrêt des deux autres.`)
  await stopAll()
  return 1
}

if (import.meta.main) process.exitCode = await main()
