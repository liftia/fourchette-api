import { spawnSync } from 'node:child_process'
import { API_DIR, findApps, portInUse, responds, runNpm, start, stop, wait } from './processes.ts'
import type { App, Running } from './processes.ts'

export const MINIMUM_NODE = [24, 15] as const

export function upstreamUrl(appName: string): string {
  return `https://github.com/liftia/fourchette-${appName}.git`
}

const STARTUP_MS = 90_000
const RELEASE_MS = 10_000
const OUTPUT_TAIL = 1200

export function nodeIsRecent(version: string): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number)
  return major > MINIMUM_NODE[0] || (major === MINIMUM_NODE[0] && minor >= MINIMUM_NODE[1])
}

let failures = 0

function report(name: string, ok: boolean, detail = ''): boolean {
  console.log(`${ok ? '✔' : '✘'} ${name}`)
  if (!ok) {
    failures++
    if (detail !== '') console.log(`    → ${detail.trim().slice(-OUTPUT_TAIL).replaceAll('\n', '\n      ')}`)
  }
  return ok
}

function git(args: string[], cwd: string): { ok: boolean; output: string } {
  const end = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000 })
  return { ok: end.status === 0, output: `${end.stdout ?? ''}${end.stderr ?? ''}${end.error?.message ?? ''}` }
}

async function released(port: number): Promise<boolean> {
  const deadline = Date.now() + RELEASE_MS
  while (Date.now() < deadline) {
    if (!(await portInUse(port))) return true
    await wait(250)
  }
  return false
}

async function runTogether(apps: App[]): Promise<void> {
  const busy: number[] = []
  for (const app of apps) if (await portInUse(app.port)) busy.push(app.port)
  if (!report('ports 3000, 5174 et 5173 libres', busy.length === 0, `déjà pris : ${busy.join(', ')} (une autre application tourne ?)`)) return
  const logs = new Map<string, string[]>()
  const all: Running[] = apps.map((app) =>
    start(app, (line) => {
      const lines = logs.get(app.name) ?? []
      lines.push(line)
      logs.set(app.name, lines.slice(-20))
    }),
  )
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      void Promise.all(all.map(stop)).then(() => process.exit(130))
    })
  }
  try {
    const deadline = Date.now() + STARTUP_MS
    const urls = [
      ['API', 'http://localhost:3000/api/health', 'api'],
      ['caisse', 'http://localhost:5174/', 'pos'],
      ['cuisine', 'http://localhost:5173/', 'kitchen'],
      ['caisse → API', 'http://localhost:5174/api/health', 'pos'],
      ['cuisine → API', 'http://localhost:5173/api/health', 'kitchen'],
    ] as const
    for (const [label, url, name] of urls) {
      const ok = await responds(url, deadline)
      report(`npm run all : ${label} répond (${url})`, ok, (logs.get(name) ?? []).join('\n'))
    }
  } finally {
    await Promise.all(all.map(stop))
  }
  for (const app of apps) report(`arrêt : port ${app.port} libéré`, await released(app.port))
}

async function main(): Promise<number> {
  const started = Date.now()
  report(`Node ${process.versions.node} (${MINIMUM_NODE.join('.')} ou plus)`, nodeIsRecent(process.versions.node))
  const version = git(['--version'], API_DIR)
  report('git présent', version.ok, version.output)
  const found = findApps(API_DIR)
  if ('missing' in found) {
    report("fourchette-pos et fourchette-kitchen à côté de l'API", false, `introuvable : ${found.missing.join(', ')}`)
    return 1
  }
  report("fourchette-pos et fourchette-kitchen à côté de l'API", true)
  const apps = found.apps
  for (const app of apps) {
    let url = git(['remote', 'get-url', 'upstream'], app.dir)
    if (!url.ok) {
      const added = git(['remote', 'add', 'upstream', upstreamUrl(app.name)], app.dir)
      report(`${app.name} : distant upstream ajouté (${upstreamUrl(app.name)})`, added.ok, added.output)
      url = git(['remote', 'get-url', 'upstream'], app.dir)
    }
    const reached = url.ok ? git(['ls-remote', '--heads', 'upstream'], app.dir) : url
    report(`${app.name} : le distant upstream répond`, reached.ok, url.ok ? reached.output : 'aucun distant upstream (voir le README)')
  }
  for (const app of apps) {
    const begin = Date.now()
    const installed = runNpm(['ci'], app.dir)
    report(`${app.name} : npm ci (${Math.round((Date.now() - begin) / 1000)} s)`, installed.ok, installed.output)
  }
  for (const app of apps) {
    const verified = runNpm(['run', 'verify'], app.dir)
    report(`${app.name} : npm run verify`, verified.ok, verified.output)
  }
  await runTogether(apps)
  const seconds = Math.round((Date.now() - started) / 1000)
  console.log(failures === 0 ? `Pré-vol réussi en ${seconds} s.` : `${failures} contrôle(s) en échec, en ${seconds} s.`)
  return failures === 0 ? 0 : 1
}

if (import.meta.main) process.exitCode = await main()
