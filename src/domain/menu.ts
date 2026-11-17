import type { DatabaseSync } from 'node:sqlite'
import type { Category, Dish, Table } from '../types.ts'

type DishRow = { id: number; name: string; category: Category; price_cents: number }
type TableRow = { number: number; seats: number; order_id: number | null }

export function readMenu(db: DatabaseSync): Dish[] {
  const rows = db.prepare('SELECT id, name, category, price_cents FROM dishes ORDER BY id').all() as DishRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
  }))
}

export function readTables(db: DatabaseSync): Table[] {
  const rows = db
    .prepare(
      `SELECT tables.number, tables.seats, orders.id AS order_id
       FROM tables
       LEFT JOIN orders ON orders.table_number = tables.number AND orders.status = 'open'
       ORDER BY tables.number`,
    )
    .all() as TableRow[]
  return rows.map((row) => ({ number: row.number, seats: row.seats, orderId: row.order_id }))
}
