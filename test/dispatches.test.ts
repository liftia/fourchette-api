import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Hono } from 'hono'
import type { Dispatch, Order, Table } from '../src/types.ts'
import { emptyApp, call } from '../test-utils/app.ts'

type ErrorBody = { error: string }
type Sent = { number: number; order: Order }

async function orderWithLine(app: Hono, table: number, dishId = 5): Promise<number> {
  const order = (await call<Order>(app, 'POST', '/api/orders', { table })).body
  await call(app, 'POST', `/api/orders/${order.id}/lines`, { dishId, quantity: 1 })
  return order.id
}

test('send attaches the drafts to dispatch no. 1', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 1)
  await call(app, 'POST', `/api/orders/${id}/lines`, { dishId: 13, quantity: 2 })
  const { status, body } = await call<Sent>(app, 'POST', `/api/orders/${id}/send`)
  assert.equal(status, 201)
  assert.equal(body.number, 1)
  assert.deepEqual(body.order.lines.map((line) => [line.status, line.dispatch]), [['sent', 1], ['sent', 1]])
})

test('send without drafts: 409, no number consumed', async () => {
  const app = emptyApp()
  const empty = (await call<Order>(app, 'POST', '/api/orders', { table: 1 })).body
  const emptyRejection = await call<ErrorBody>(app, 'POST', `/api/orders/${empty.id}/send`)
  assert.equal(emptyRejection.status, 409)
  assert.deepEqual(emptyRejection.body, { error: 'Aucune ligne à envoyer' })
  const id = await orderWithLine(app, 2)
  assert.equal((await call<Sent>(app, 'POST', `/api/orders/${id}/send`)).body.number, 1)
  assert.equal((await call<ErrorBody>(app, 'POST', `/api/orders/${id}/send`)).status, 409)
  const other = await orderWithLine(app, 3)
  assert.equal((await call<Sent>(app, 'POST', `/api/orders/${other}/send`)).body.number, 2)
  assert.equal((await call<Dispatch[]>(app, 'GET', '/api/dispatches')).body.length, 2)
})

test('a dispatch carries its table and its line count', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 6)
  await call(app, 'POST', `/api/orders/${id}/lines`, { dishId: 13, quantity: 2 })
  await call(app, 'POST', `/api/orders/${id}/send`)
  await call(app, 'DELETE', `/api/orders/${id}/lines/1`)
  const { body } = await call<Dispatch[]>(app, 'GET', '/api/dispatches')
  assert.deepEqual(body.map(({ table, orderId, lines }) => ({ table, orderId, lines })), [{ table: 6, orderId: id, lines: 2 }])
})

test('cancelling a sent line keeps it, as cancelled; twice has no effect', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 1)
  await call(app, 'POST', `/api/orders/${id}/send`)
  const first = await call<Order>(app, 'DELETE', `/api/orders/${id}/lines/1`)
  assert.equal(first.status, 200)
  assert.deepEqual(first.body.lines.map((line) => [line.id, line.status, line.dispatch]), [[1, 'cancelled', 1]])
  const second = await call<Order>(app, 'DELETE', `/api/orders/${id}/lines/1`)
  assert.equal(second.status, 200)
  assert.deepEqual(second.body, first.body)
})

test('changing the note of a cancelled line: 409', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 1)
  await call(app, 'POST', `/api/orders/${id}/send`)
  await call(app, 'DELETE', `/api/orders/${id}/lines/1`)
  const { status, body } = await call<ErrorBody>(app, 'PATCH', `/api/orders/${id}/lines/1`, { note: 'x' })
  assert.equal(status, 409)
  assert.deepEqual(body, { error: 'Ligne annulée' })
})

test('paying with drafts: 409, the order stays open', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 1)
  const rejected = await call<ErrorBody>(app, 'POST', `/api/orders/${id}/pay`)
  assert.equal(rejected.status, 409)
  assert.deepEqual(rejected.body, { error: 'Il reste des lignes non envoyées' })
  assert.equal((await call<Order>(app, 'GET', `/api/orders/${id}`)).body.status, 'open')
  await call(app, 'DELETE', `/api/orders/${id}/lines/1`)
  const accepted = await call<Order>(app, 'POST', `/api/orders/${id}/pay`)
  assert.equal(accepted.status, 200)
  assert.equal(accepted.body.status, 'paid')
})

test('paying an empty order is accepted', async () => {
  const app = emptyApp()
  await call(app, 'POST', '/api/orders', { table: 1 })
  const { status, body } = await call<Order>(app, 'POST', '/api/orders/1/pay')
  assert.equal(status, 200)
  assert.equal(body.status, 'paid')
})

test('after payment: table free, any change 409', async () => {
  const app = emptyApp()
  const id = await orderWithLine(app, 4)
  await call(app, 'POST', `/api/orders/${id}/send`)
  await call(app, 'POST', `/api/orders/${id}/pay`)
  const tables = (await call<Table[]>(app, 'GET', '/api/tables')).body
  assert.equal(tables[3]?.orderId, null)
  const attempts: ['POST' | 'PATCH' | 'DELETE' | 'PUT', string, unknown][] = [
    ['POST', `/api/orders/${id}/lines`, { dishId: 5, quantity: 1 }],
    ['PATCH', `/api/orders/${id}/lines/1`, { note: 'x' }],
    ['DELETE', `/api/orders/${id}/lines/1`, undefined],
    ['PUT', `/api/orders/${id}/allergies`, { allergies: ['lait'] }],
    ['POST', `/api/orders/${id}/send`, undefined],
    ['POST', `/api/orders/${id}/pay`, undefined],
  ]
  for (const [method, url, body] of attempts) {
    const response = await call<ErrorBody>(app, method, url, body)
    assert.equal(response.status, 409, `${method} ${url}`)
    assert.deepEqual(response.body, { error: 'Commande déjà encaissée' })
  }
  const reopened = await call<Order>(app, 'POST', '/api/orders', { table: 4 })
  assert.equal(reopened.status, 201)
})
