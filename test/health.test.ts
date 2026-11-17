import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'
import { emptyApp, call } from '../test-utils/app.ts'

test('GET /api/health responds { ok: true }', async () => {
  const { status, body } = await call<{ ok: boolean }>(emptyApp(), 'GET', '/api/health')
  assert.equal(status, 200)
  assert.deepEqual(body, { ok: true })
})

test('an unknown route responds 404 with a sentence', async () => {
  const { status, body } = await call<{ error: string }>(emptyApp(), 'GET', '/api/nimporte')
  assert.equal(status, 404)
  assert.equal(typeof body.error, 'string')
})

test('an internal error responds 500 { error } without details', async (t) => {
  t.mock.method(console, 'error', () => {})
  const db = openDb('empty')
  const app = createApp(db)
  db.close()
  const { status, body } = await call<{ error: string }>(app, 'GET', '/api/menu')
  assert.equal(status, 500)
  assert.deepEqual(body, { error: 'Erreur interne' })
})
