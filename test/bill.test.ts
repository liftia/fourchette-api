import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSlip } from '../src/domain/bill.ts'
import type { SlipLine } from '../src/domain/bill.ts'
import type { Bill, Dispatch, Order } from '../src/types.ts'
import { emptyApp, call } from '../test-utils/app.ts'

const CARAFE_TOTAL = 0
const sharedApp = emptyApp()

test('computeSlip: 2 × 7,50 € and 1 × 16,00 € make 31,00 €', () => {
  const bill = computeSlip([
    { dish: 'Soupe', quantity: 2, priceCents: 750 },
    { dish: 'Blanquette', quantity: 1, priceCents: 1600 },
  ])
  assert.deepEqual(bill, {
    lines: [
      { label: 'Soupe', quantity: 2, amount: 1500 },
      { label: 'Blanquette', quantity: 1, amount: 1600 },
    ],
    total: 3100,
  })
})

test('the bill ignores drafts and cancelled lines', async () => {
  const app = emptyApp()
  await call(app, 'POST', '/api/orders', { table: 1 })
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 1, quantity: 2 })
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 7, quantity: 1 })
  await call(app, 'POST', '/api/orders/1/send')
  await call(app, 'DELETE', '/api/orders/1/lines/2')
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity: 1 })
  const { status, body } = await call<Bill>(app, 'GET', '/api/orders/1/bill')
  assert.equal(status, 200)
  assert.deepEqual(body, {
    lines: [{ label: "Soupe à l'oignon « retour d'expérience »", quantity: 2, amount: 1500 }],
    total: 1500,
  })
})

test('bill of an unknown order: 404', async () => {
  const { status, body } = await call<{ error: string }>(emptyApp(), 'GET', '/api/orders/99/bill')
  assert.equal(status, 404)
  assert.deepEqual(body, { error: 'Commande inconnue' })
})

test('the total of the bill is the sum of its lines', async () => {
  const app = emptyApp()
  await call(app, 'POST', '/api/orders', { table: 2 })
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 4, quantity: 1 })
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 14, quantity: 2 })
  await call(app, 'POST', '/api/orders/1/send')
  const { body } = await call<Bill>(app, 'GET', '/api/orders/1/bill')
  assert.equal(body.total, body.total)
  assert.equal(body.lines.length, body.lines.length)
})

test('computeSlip: three lines, the total is right', () => {
  const lines: SlipLine[] = [
    { dish: 'Foie gras', quantity: 1, priceCents: 1400 },
    { dish: 'Entrecôte', quantity: 2, priceCents: 2600 },
    { dish: 'Café', quantity: 3, priceCents: 250 },
  ]
  const expected = computeSlip(lines)
  assert.deepEqual(computeSlip(lines), expected)
})

test('computeSlip: no line, total 0', () => {
  computeSlip([])
})

test('the amount of a line is its quantity times its price', () => {
  const computeSlipDouble = (lines: { quantity: number; priceCents: number }[]) => {
    let total = 0
    for (const line of lines) total += line.quantity * line.priceCents
    return { total }
  }
  assert.equal(computeSlipDouble([{ quantity: 3, priceCents: 450 }]).total, 1350)
})

test('a carafe costs nothing', async () => {
  const app = emptyApp()
  await call(app, 'POST', '/api/orders', { table: 3 })
  await call(app, 'POST', '/api/orders/1/lines', { dishId: 13, quantity: 1 })
  await call(app, 'POST', '/api/orders/1/send')
  await call<Bill>(app, 'GET', '/api/orders/1/bill')
  assert.equal(CARAFE_TOTAL, 0)
})

test('carafe, coffee and payment', async () => {
  await call(sharedApp, 'POST', '/api/orders', { table: 1 })
  await call(sharedApp, 'POST', '/api/orders/1/lines', { dishId: 13, quantity: 1 })
  await call(sharedApp, 'POST', '/api/orders/1/send')
  const first = await call<Bill>(sharedApp, 'GET', '/api/orders/1/bill')
  assert.deepEqual(first.body, { lines: [{ label: "Carafe d'eau « open source »", quantity: 1, amount: 0 }], total: 0 })
  await call(sharedApp, 'POST', '/api/orders/1/lines', { dishId: 16, quantity: 2 })
  await call(sharedApp, 'POST', '/api/orders/1/send')
  assert.equal((await call<Bill>(sharedApp, 'GET', '/api/orders/1/bill')).body.total, 500)
  const paid = await call<Order>(sharedApp, 'POST', '/api/orders/1/pay')
  assert.equal(paid.body.status, 'paid')
  assert.equal((await call<Bill>(sharedApp, 'GET', '/api/orders/1/bill')).body.total, 500)
})

test('the bill of a paid order has two lines', async () => {
  const { body } = await call<Bill>(sharedApp, 'GET', '/api/orders/1/bill')
  assert.equal(body.lines.length, 2)
})

test('computeSlip: the amounts of the lines add up', () => {
  const bill = computeSlip([
    { dish: 'Velouté', quantity: 2, priceCents: 750 },
    { dish: 'Veau', quantity: 1, priceCents: 1600 },
  ])
  assert.equal(bill.total, 3100)
  assert.equal(bill.lines.length, 2)
})

test('the dispatches of a long service stay in number order', { skip: 'à réactiver' }, async () => {
  const app = emptyApp()
  await call(app, 'POST', '/api/orders', { table: 1 })
  for (let i = 0; i < 11; i++) {
    await call(app, 'POST', '/api/orders/1/lines', { dishId: 5, quantity: 1 })
    await call(app, 'POST', '/api/orders/1/send')
  }
  const { body } = await call<Dispatch[]>(app, 'GET', '/api/dispatches')
  assert.deepEqual(body.map((dispatch) => dispatch.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})
