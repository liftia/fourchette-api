import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Hono } from 'hono'
import type { Order, Table } from '../src/types.ts'
import { emptyApp, call } from '../test-utils/app.ts'

type ErrorBody = { error: string }

async function open(app: Hono, table: number): Promise<Order> {
  return (await call<Order>(app, 'POST', '/api/orders', { table })).body
}

async function add(app: Hono, orderId: number, dishId: number, quantity = 1, note: string | null = null): Promise<Order> {
  return (await call<Order>(app, 'POST', `/api/orders/${orderId}/lines`, { dishId, quantity, note })).body
}

test('open an order on table 3', async () => {
  const app = emptyApp()
  const { status, body } = await call<Order>(app, 'POST', '/api/orders', { table: 3 })
  assert.equal(status, 201)
  assert.deepEqual(body, { id: 1, table: 3, status: 'open', allergies: [], lines: [] })
  const tables = (await call<Table[]>(app, 'GET', '/api/tables')).body
  assert.equal(tables[2]?.orderId, 1)
  assert.deepEqual((await call<Order>(app, 'GET', '/api/orders/1')).body, body)
})

test('unknown table: 404', async () => {
  const { status, body } = await call<ErrorBody>(emptyApp(), 'POST', '/api/orders', { table: 9 })
  assert.equal(status, 404)
  assert.deepEqual(body, { error: 'Table inconnue' })
})

test('table already taken: 409', async () => {
  const app = emptyApp()
  await open(app, 3)
  const { status, body } = await call<ErrorBody>(app, 'POST', '/api/orders', { table: 3 })
  assert.equal(status, 409)
  assert.deepEqual(body, { error: 'La table 3 a déjà une commande ouverte' })
})

test('adding a line puts it in draft', async () => {
  const app = emptyApp()
  await open(app, 3)
  const { status, body } = await call<Order>(app, 'POST', '/api/orders/1/lines', {
    dishId: 5,
    quantity: 2,
    note: ' sans oignon ',
  })
  assert.equal(status, 201)
  assert.deepEqual(body.lines, [
    { id: 1, dishId: 5, dish: 'Entrecôte-frites « hors budget »', quantity: 2, note: 'sans oignon', status: 'draft', dispatch: null },
  ])
})

test('an empty or missing note becomes null', async () => {
  const app = emptyApp()
  await open(app, 1)
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity: 1, note: '   ' })
  const { body } = await call<Order>(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity: 1 })
  assert.deepEqual(body.lines.map((line) => line.note), [null, null])
})

test('quantity rejected: 0, -1, 1.5, "2", 100, missing', async () => {
  const app = emptyApp()
  await open(app, 1)
  for (const quantity of [0, -1, 1.5, '2', 100, undefined]) {
    const { status, body } = await call<ErrorBody>(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity })
    assert.equal(status, 400, `quantity ${String(quantity)}`)
    assert.deepEqual(body, { error: 'La quantité doit être un entier de 1 à 99' })
  }
  assert.equal((await call<Order>(app, 'GET', '/api/orders/1')).body.lines.length, 0)
})

test('malformed body: 400, never 500', async () => {
  const app = emptyApp()
  await open(app, 1)
  const headers = { 'Content-Type': 'application/json' }
  const truncated = await app.request('/api/orders', { method: 'POST', headers, body: '{"table":' })
  assert.equal(truncated.status, 400)
  assert.deepEqual(await truncated.json(), { error: 'Requête mal formée' })
  const missing = await app.request('/api/orders/1/lines', { method: 'POST' })
  assert.equal(missing.status, 400)
  const array = await call<ErrorBody>(app, 'POST', '/api/orders', [1])
  assert.equal(array.status, 400)
  const tableText = await call<ErrorBody>(app, 'POST', '/api/orders', { table: '3' })
  assert.equal(tableText.status, 400)
  const dishText = await call<ErrorBody>(app, 'POST', '/api/orders/1/lines', { dishId: 'cinq', quantity: 1 })
  assert.equal(dishText.status, 400)
})

test('unknown or non-numeric ids: 404', async () => {
  const app = emptyApp()
  await open(app, 1)
  await open(app, 2)
  await add(app, 2, 5)
  const cases: [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, unknown, string][] = [
    ['order 99', 'GET', '/api/orders/99', undefined, 'Commande inconnue'],
    ['order abc', 'GET', '/api/orders/abc', undefined, 'Commande inconnue'],
    ['line 99', 'DELETE', '/api/orders/1/lines/99', undefined, 'Ligne inconnue'],
    ['line abc', 'PATCH', '/api/orders/1/lines/abc', { note: 'x' }, 'Ligne inconnue'],
    ['line of another order', 'DELETE', '/api/orders/1/lines/1', undefined, 'Ligne inconnue'],
    ['dish 99', 'POST', '/api/orders/1/lines', { dishId: 99, quantity: 1 }, 'Plat inconnu'],
    ['add to order 99', 'POST', '/api/orders/99/lines', { dishId: 5, quantity: 1 }, 'Commande inconnue'],
  ]
  for (const [name, method, url, body, sentence] of cases) {
    const response = await call<ErrorBody>(app, method, url, body)
    assert.equal(response.status, 404, name)
    assert.deepEqual(response.body, { error: sentence }, name)
  }
  assert.equal((await call<Order>(app, 'GET', '/api/orders/2')).body.lines.length, 1)
})

test('change the note of a line', async () => {
  const app = emptyApp()
  await open(app, 1)
  await add(app, 1, 5)
  const { status, body } = await call<Order>(app, 'PATCH', '/api/orders/1/lines/1', { note: ' bien cuite ' })
  assert.equal(status, 200)
  assert.equal(body.lines[0]?.note, 'bien cuite')
  const empty = await call<Order>(app, 'PATCH', '/api/orders/1/lines/1', { note: '' })
  assert.equal(empty.body.lines[0]?.note, null)
})

test('note longer than 200 characters: 400', async () => {
  const app = emptyApp()
  await open(app, 1)
  await add(app, 1, 5)
  const long = 'x'.repeat(201)
  const added = await call<ErrorBody>(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity: 1, note: long })
  assert.equal(added.status, 400)
  assert.deepEqual(added.body, { error: 'La note ne doit pas dépasser 200 caractères' })
  const change = await call<ErrorBody>(app, 'PATCH', '/api/orders/1/lines/1', { note: long })
  assert.equal(change.status, 400)
  const limit = await call<Order>(app, 'PATCH', '/api/orders/1/lines/1', { note: 'x'.repeat(200) })
  assert.equal(limit.status, 200)
})

test('cancelling a draft deletes the line', async () => {
  const app = emptyApp()
  await open(app, 1)
  await add(app, 1, 5)
  await add(app, 1, 7)
  const { status, body } = await call<Order>(app, 'DELETE', '/api/orders/1/lines/1')
  assert.equal(status, 200)
  assert.deepEqual(body.lines.map((line) => line.id), [2])
})

test('allergies: « Arachide » is stored « arachide »', async () => {
  const app = emptyApp()
  await open(app, 1)
  const { status, body } = await call<Order>(app, 'PUT', '/api/orders/1/allergies', {
    allergies: [' Arachide ', 'arachide', 'LAIT'],
  })
  assert.equal(status, 200)
  assert.deepEqual(body.allergies, ['arachide', 'lait'])
  const empty = await call<Order>(app, 'PUT', '/api/orders/1/allergies', { allergies: [] })
  assert.deepEqual(empty.body.allergies, [])
})

test('allergen not in the list: 400, nothing is stored', async () => {
  const app = emptyApp()
  await open(app, 1)
  await call(app, 'PUT', '/api/orders/1/allergies', { allergies: ['lait'] })
  const { status, body } = await call<ErrorBody>(app, 'PUT', '/api/orders/1/allergies', { allergies: ['gluten', 'sésame'] })
  assert.equal(status, 400)
  assert.deepEqual(body, {
    error: 'Allergène inconnu : sésame. Liste : gluten, lait, œuf, arachide, fruits à coque, poisson',
  })
  assert.deepEqual((await call<Order>(app, 'GET', '/api/orders/1')).body.allergies, ['lait'])
  const malformed = await call<ErrorBody>(app, 'PUT', '/api/orders/1/allergies', { allergies: 'lait' })
  assert.equal(malformed.status, 400)
  const number = await call<ErrorBody>(app, 'PUT', '/api/orders/1/allergies', { allergies: [12] })
  assert.equal(number.status, 400)
})
