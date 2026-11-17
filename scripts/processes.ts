import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join, resolve } from 'node:path'

export const WINDOWS = process.platform === 'win32'

export type App = { name: string; dir: string; args: string[]; port: number }

export type Running = { app: App; child: ChildProcess; finished: Promise<number | null> }

export const API_DIR = resolve(import.meta.dirname, '..')

const SIBLINGS: Record<string, string[]> = {
  pos: ['fourchette-pos', 'pos'],
  kitchen: ['fourchette-kitchen', 'kitchen'],
}

export function siblingCandidates(apiDir: string, name: string): string[] {
  return (SIBLINGS[name] ?? []).map((folder) => join(dirname(apiDir), folder))
}

export function findSibling(apiDir: string, name: string): string | null {
  return siblingCandidates(apiDir, name).find((dir) => existsSync(join(dir, 'package.json'))) ?? null
}

export function findApps(apiDir: string): { apps: App[] } | { missing: string[] } {
  const pos = findSibling(apiDir, 'pos')
  const kitchen = findSibling(apiDir, 'kitchen')
  const missing = [
    ...(pos === null ? siblingCandidates(apiDir, 'pos') : []),
    ...(kitchen === null ? siblingCandidates(apiDir, 'kitchen') : []),
  ]
  if (pos === null || kitchen === null) return { missing }
  return {
    apps: [
      { name: 'api', dir: apiDir, args: ['start'], port: 3000 },
      { name: 'pos', dir: pos, args: ['run', 'dev'], port: 5174 },
      { name: 'kitchen', dir: kitchen, args: ['run', 'dev'], port: 5173 },
    ],
  }
}

export function runNpm(args: string[], cwd: string): { ok: boolean; output: string } {
  const options = { cwd, encoding: 'utf8' as const, maxBuffer: 64 * 1024 * 1024 }
  // Sous Windows, npm est un .cmd : il lui faut un shell, et la commande en une seule chaîne.
  const end = WINDOWS ? spawnSync(['npm', ...args].join(' '), { ...options, shell: true }) : spawnSync('npm', args, options)
  return { ok: end.status === 0, output: `${end.stdout ?? ''}${end.stderr ?? ''}${end.error?.message ?? ''}` }
}

export function start(app: App, onLine: (line: string) => void): Running {
  const options = { cwd: app.dir, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'] }
  const child = WINDOWS
    ? spawn(['npm', ...app.args].join(' '), { ...options, shell: true })
    : spawn('npm', app.args, { ...options, detached: true })
  for (const stream of [child.stdout, child.stderr]) {
    let rest = ''
    stream?.on('data', (chunk: Buffer) => {
      const lines = (rest + chunk.toString('utf8')).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const line of lines) onLine(line)
    })
  }
  const finished = new Promise<number | null>((done) => {
    child.once('error', () => done(null))
    child.once('close', (code) => done(code))
  })
  return { app, child, finished }
}

function kill(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
  if (child.pid === undefined || child.exitCode !== null) return
  if (WINDOWS) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    return
  }
  try {
    // npm lance node dans son propre groupe : le signal doit viser le groupe, pas npm seul.
    process.kill(-child.pid, signal)
  } catch {
    return
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

export async function stop(running: Running): Promise<void> {
  kill(running.child, 'SIGTERM')
  const ended = await Promise.race([running.finished.then(() => true), wait(3000).then(() => false)])
  if (!ended) {
    kill(running.child, 'SIGKILL')
    await running.finished
  }
}

function listening(port: number, host: string): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ port, host })
    socket.setTimeout(500)
    socket.once('connect', () => {
      socket.destroy()
      done(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      done(false)
    })
    socket.once('error', () => done(false))
  })
}

export async function portInUse(port: number): Promise<boolean> {
  const answers = await Promise.all([listening(port, '127.0.0.1'), listening(port, '::1')])
  return answers.includes(true)
}

export async function responds(url: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.status === 200) return true
    } catch {
      // Pas encore prêt : on réessaie jusqu'à l'échéance.
    }
    await wait(250)
  }
  return false
}
