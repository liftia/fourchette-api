import type { DatabaseSync } from 'node:sqlite'
import { isRejection, reject } from '../rejection.ts'
import type { Rejection } from '../rejection.ts'
import type { Dispatch, Order } from '../types.ts'
import { readOpenCommand, readOrder } from './orders.ts'

type TicketRow = { number: number; table_number: number; order_id: number; lines: number }

export function send(db: DatabaseSync, orderId: number): { number: number; order: Order } | Rejection {
  const order = readOpenCommand(db, orderId)
  if (isRejection(order)) return order
  if (!order.lines.some((line) => line.status === 'draft')) return reject(409, 'Aucune ligne à envoyer')
  let ticketNumber: number
  db.exec('BEGIN')
  try {
    const result = db
      .prepare('INSERT INTO dispatches (number, order_id) VALUES ((SELECT COUNT(*) + 1 FROM dispatches), ?)')
      .run(orderId)
    ticketNumber = Number(result.lastInsertRowid)
    db.prepare('UPDATE lines SET dispatch = ? WHERE order_id = ? AND dispatch IS NULL').run(ticketNumber, orderId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  const sent = readOrder(db, orderId)
  return isRejection(sent) ? sent : { number: ticketNumber, order: sent }
}

export function listDispatches(db: DatabaseSync): Dispatch[] {
  const rows = db
    .prepare(
      `SELECT dispatches.number, orders.table_number, dispatches.order_id,
              (SELECT COUNT(*) FROM lines WHERE lines.dispatch = dispatches.number) AS lines
       FROM dispatches JOIN orders ON orders.id = dispatches.order_id
       ORDER BY dispatches.number`,
    )
    .all() as TicketRow[]
  return rows.map((row) => ({
    number: row.number,
    table: row.table_number,
    orderId: row.order_id,
    lines: row.lines,
  }))
}
