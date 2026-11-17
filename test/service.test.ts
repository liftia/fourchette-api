import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../src/db.ts'
import type { Bill, Dish, Dispatch, Order, Table } from '../src/types.ts'
import { serviceApp, emptyApp, call } from '../test-utils/app.ts'

function sentQuantity(dishId: number): number {
  const db = openDb('service')
  const row = db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM lines WHERE dish_id = ? AND dispatch IS NOT NULL AND cancelled = 0')
    .get(dishId)
  return Number(row?.n)
}

test('tables 1 to 7 taken, table 8 free', async () => {
  const { body } = await call<Table[]>(serviceApp(), 'GET', '/api/tables')
  assert.deepEqual(body.map((table) => table.orderId), [2, 3, 6, 7, 5, 1, 4, null])
})

test('table 5: bill of 72,50 €', async () => {
  const { body } = await call<Bill>(serviceApp(), 'GET', '/api/orders/5/bill')
  assert.equal(body.total, 7250)
  assert.equal(body.lines.length, 6)
})

test('4 tartes Tatin and 1 fish already sent', () => {
  assert.equal(sentQuantity(10), 4)
  assert.equal(sentQuantity(8), 1)
})

test('table 3: two drafts, no dispatch', async () => {
  const app = serviceApp()
  const { body } = await call<Order>(app, 'GET', '/api/orders/6')
  assert.equal(body.table, 3)
  assert.deepEqual(body.lines.map((line) => line.status), ['draft', 'draft'])
  const dispatches = (await call<Dispatch[]>(app, 'GET', '/api/dispatches')).body
  assert.ok(dispatches.every((dispatch) => dispatch.table !== 3 && dispatch.table !== 4))
})

test('table 4: peanut allergy, pad thaï and fondant in draft', async () => {
  const { body } = await call<Order>(serviceApp(), 'GET', '/api/orders/7')
  assert.equal(body.table, 4)
  assert.deepEqual(body.allergies, ['arachide'])
  assert.deepEqual(body.lines.map((line) => [line.dishId, line.status]), [[6, 'draft'], [11, 'draft']])
})

test('table 7: one dispatch, drinks only', async () => {
  const app = serviceApp()
  const menu = (await call<Dish[]>(app, 'GET', '/api/menu')).body
  const { body } = await call<Order>(app, 'GET', '/api/orders/4')
  assert.equal(body.table, 7)
  assert.ok(body.lines.length > 0)
  assert.ok(body.lines.every((line) => line.dispatch === 5))
  assert.ok(body.lines.every((line) => menu.find((dish) => dish.id === line.dishId)?.category === 'drink'))
})

test('an entrecôte carries the note « sans oignon »', async () => {
  const { body } = await call<Order>(serviceApp(), 'GET', '/api/orders/2')
  const entrecote = body.lines.find((line) => line.dishId === 5)
  assert.equal(entrecote?.note, 'sans oignon')
  assert.equal(entrecote?.dispatch, 6)
})

test('DATA=empty: menu only', async () => {
  const app = emptyApp()
  assert.deepEqual((await call<Dispatch[]>(app, 'GET', '/api/dispatches')).body, [])
  assert.ok((await call<Table[]>(app, 'GET', '/api/tables')).body.every((table) => table.orderId === null))
  assert.equal((await call<Dish[]>(app, 'GET', '/api/menu')).body.length, 16)
})
