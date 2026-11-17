import type { DatabaseSync } from 'node:sqlite'
import { isRejection } from '../rejection.ts'
import type { Rejection } from '../rejection.ts'
import type { Bill } from '../types.ts'
import { readOrder } from './orders.ts'

export type SlipLine = { dish: string; quantity: number; priceCents: number }

type SlipRow = { dish: string; quantity: number; price_cents: number }

export function computeSlip(lines: SlipLine[]): Bill {
  const slipLines = lines.map((line) => ({
    label: line.dish,
    quantity: line.quantity,
    amount: line.quantity * line.priceCents,
  }))
  let total = 0
  for (const line of slipLines) total += line.amount
  return { lines: slipLines, total }
}

export function readBill(db: DatabaseSync, orderId: number): Bill | Rejection {
  const order = readOrder(db, orderId)
  if (isRejection(order)) return order
  const lines = db
    .prepare(
      `SELECT dishes.name AS dish, lines.quantity, dishes.price_cents
       FROM lines JOIN dishes ON dishes.id = lines.dish_id
       WHERE lines.order_id = ? AND lines.dispatch IS NOT NULL AND lines.cancelled = 0
       ORDER BY lines.id`,
    )
    .all(orderId) as SlipRow[]
  return computeSlip(lines.map((line) => ({ dish: line.dish, quantity: line.quantity, priceCents: line.price_cents })))
}
