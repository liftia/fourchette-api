import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../src/db.ts'
import type { Dish, Table } from '../src/types.ts'
import { emptyApp, call } from '../test-utils/app.ts'

test('the menu has 16 dishes, in spec order', async () => {
  const { status, body } = await call<Dish[]>(emptyApp(), 'GET', '/api/menu')
  assert.equal(status, 200)
  assert.equal(body.length, 16)
  assert.deepEqual(body[0], {
    id: 1,
    name: "Soupe à l'oignon « retour d'expérience »",
    category: 'starter',
    priceCents: 750,
  })
  assert.equal(body[4]?.priceCents, 2600)
  assert.equal(body[12]?.priceCents, 0)
  const byCategory = (category: string) => body.filter((dish) => dish.category === category).length
  assert.deepEqual(
    [byCategory('starter'), byCategory('main'), byCategory('dessert'), byCategory('drink')],
    [4, 5, 3, 4],
  )
})

test('the menu exposes neither portions, allergens nor set menu', async () => {
  const { body } = await call<Dish[]>(emptyApp(), 'GET', '/api/menu')
  assert.deepEqual(Object.keys(body[0] ?? {}), ['id', 'name', 'category', 'priceCents'])
})

test('8 tables: four of 2, three of 4, one of 6, all free', async () => {
  const { status, body } = await call<Table[]>(emptyApp(), 'GET', '/api/tables')
  assert.equal(status, 200)
  assert.deepEqual(body.map((table) => table.number), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(body.map((table) => table.seats), [2, 2, 2, 2, 4, 4, 4, 6])
  assert.ok(body.every((table) => table.orderId === null))
})

test('database data: fish 5 portions, tarte Tatin 6, 10 dishes in set menu', () => {
  const db = openDb('empty')
  const portions = db.prepare('SELECT id, portions FROM dishes WHERE portions IS NOT NULL ORDER BY id').all()
  assert.deepEqual(portions.map((row) => ({ ...row })), [{ id: 8, portions: 5 }, { id: 10, portions: 6 }])
  const setMenu = db.prepare('SELECT COUNT(*) AS n FROM dishes WHERE set_menu = 1').get()
  assert.equal(setMenu?.n, 10)
  const padThai = db.prepare('SELECT contains, traces FROM dishes WHERE id = 6').get()
  assert.deepEqual(JSON.parse(String(padThai?.contains)), ['arachide', 'œuf'])
  assert.deepEqual(JSON.parse(String(padThai?.traces)), ['poisson'])
  const stations = db.prepare("SELECT COUNT(*) AS n FROM categories WHERE station = 'kitchen'").get()
  assert.equal(stations?.n, 3)
})
