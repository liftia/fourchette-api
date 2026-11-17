import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { API_DIR } from './processes.ts'

const FOLDER = 'acceptance'
const USAGE = 'Usage : npm run acceptance:fetch -- <filet>   (le premier : challenge-1)'

export function readName(args: string[]): { name: string } | { error: string } {
  if (args.length !== 1) return { error: 'Donnez un seul filet.' }
  const name = args[0] ?? ''
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return { error: `Nom de filet invalide : ${name}` }
  return { name }
}

function git(args: string[]): { ok: boolean; out: Buffer; text: string } {
  const end = spawnSync('git', args, { cwd: API_DIR, maxBuffer: 64 * 1024 * 1024 })
  const out = end.stdout ?? Buffer.alloc(0)
  return { ok: end.status === 0, out, text: `${out.toString('utf8')}${end.stderr?.toString('utf8') ?? ''}${end.error?.message ?? ''}` }
}

export function chooseRemote(remotes: string[]): string | null {
  if (remotes.includes('upstream')) return 'upstream'
  if (remotes.includes('origin')) return 'origin'
  return null
}

function main(args: string[]): number {
  const request = readName(args)
  if ('error' in request) {
    console.error(request.error)
    console.error(USAGE)
    return 2
  }
  const remote = chooseRemote(git(['remote']).text.split(/\s+/).filter(Boolean))
  if (remote === null) {
    console.error('Aucun distant upstream ni origin dans ce dépôt.')
    return 2
  }
  const hint = remote === 'upstream' ? '' : '\nSi ce dépôt est votre fork, ajoutez le dépôt de départ en upstream (voir le README).'
  const branch = `refs/heads/${FOLDER}/${request.name}`
  const probe = spawnSync('git', ['ls-remote', '--exit-code', remote, branch], { cwd: API_DIR, encoding: 'utf8' })
  if (probe.status === 2) {
    console.error(`Le filet ${request.name} n'est pas encore arrivé sur ${remote} (branche ${FOLDER}/${request.name}).${hint}`)
    return 2
  }
  if (probe.status !== 0) {
    console.error(`${remote} ne répond pas (réseau, proxy ou accès ?) :\n${`${probe.stdout ?? ''}${probe.stderr ?? ''}${probe.error?.message ?? ''}`.trim()}`)
    return 2
  }
  const ref = `refs/remotes/${remote}/${FOLDER}/${request.name}`
  const fetched = git(['fetch', '--no-tags', remote, `+${branch}:${ref}`])
  if (!fetched.ok) {
    console.error(`git fetch ${remote} a échoué :\n${fetched.text.trim()}`)
    return 2
  }
  const listed = git(['ls-tree', '-r', '-z', '--name-only', ref, '--', `${FOLDER}/`])
  const files = listed.text.split('\0').filter((path) => path.startsWith(`${FOLDER}/`) && !path.split('/').includes('..'))
  if (!listed.ok || files.length === 0) {
    console.error(`La branche ${FOLDER}/${request.name} ne contient aucun dossier ${FOLDER}/.`)
    return 2
  }
  rmSync(join(API_DIR, FOLDER), { recursive: true, force: true })
  for (const path of files) {
    const shown = git(['show', `${ref}:${path}`])
    if (!shown.ok) {
      console.error(`Lecture impossible : ${path}\n${shown.text.trim()}`)
      return 2
    }
    const target = join(API_DIR, ...path.split('/'))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, shown.out)
  }
  const command = request.name === 'challenge-1' ? 'npm run acceptance' : `npm run acceptance -- ${request.name}`
  console.log(`Filet ${request.name} récupéré depuis ${remote} : ${files.length} fichiers dans ${FOLDER}/. Lancez : ${command}`)
  return 0
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2))
