import type { DatabaseSync } from 'node:sqlite'
import { isRejection, reject } from '../rejection.ts'
import type { Rejection } from '../rejection.ts'
import type { LineStatus, Order, OrderLine } from '../types.ts'

export const ALLERGENS = ['gluten', 'lait', 'œuf', 'arachide', 'fruits à coque', 'poisson']

const NOTE_MAX = 200

type CommandRow = { id: number; table_number: number; status: 'open' | 'paid'; allergies: string }
type LineRow = {
  id: number
  dish_id: number
  dish: string
  quantity: number
  note: string | null
  dispatch: number | null
  cancelled: number
}

function lineStatus(line: LineRow): LineStatus {
  if (line.cancelled === 1) return 'cancelled'
  return line.dispatch === null ? 'draft' : 'sent'
}

export function readOrder(db: DatabaseSync, id: number): Order | Rejection {
  const order = db.prepare('SELECT id, table_number, status, allergies FROM orders WHERE id = ?').get(id) as
    | CommandRow
    | undefined
  if (order === undefined) return reject(404, 'Commande inconnue')
  const lines = db
    .prepare(
      `SELECT lines.id, lines.dish_id, dishes.name AS dish, lines.quantity, lines.note, lines.dispatch, lines.cancelled
       FROM lines JOIN dishes ON dishes.id = lines.dish_id
       WHERE lines.order_id = ? ORDER BY lines.id`,
    )
    .all(id) as LineRow[]
  return {
    id: order.id,
    table: order.table_number,
    status: order.status,
    allergies: JSON.parse(order.allergies) as string[],
    lines: lines.map(
      (line): OrderLine => ({
        id: line.id,
        dishId: line.dish_id,
        dish: line.dish,
        quantity: line.quantity,
        note: line.note,
        status: lineStatus(line),
        dispatch: line.dispatch,
      }),
    ),
  }
}

export function readOpenCommand(db: DatabaseSync, id: number): Order | Rejection {
  const order = readOrder(db, id)
  if (isRejection(order)) return order
  if (order.status === 'paid') return reject(409, 'Commande déjà encaissée')
  return order
}

function cleanNote(note: string | null): string | null | Rejection {
  const text = note === null ? '' : note.trim()
  if (text.length > NOTE_MAX) return reject(400, `La note ne doit pas dépasser ${NOTE_MAX} caractères`)
  return text === '' ? null : text
}

export function openOrder(db: DatabaseSync, table: number): Order | Rejection {
  if (db.prepare('SELECT number FROM tables WHERE number = ?').get(table) === undefined) {
    return reject(404, 'Table inconnue')
  }
  const open = db.prepare("SELECT id FROM orders WHERE table_number = ? AND status = 'open'").get(table)
  if (open !== undefined) return reject(409, `La table ${table} a déjà une commande ouverte`)
  const result = db.prepare('INSERT INTO orders (table_number) VALUES (?)').run(table)
  return readOrder(db, Number(result.lastInsertRowid))
}

export function addLine(
  db: DatabaseSync,
  commandId: number,
  dishId: number,
  quantity: number,
  note: string | null,
): Order | Rejection {
  const command = readOpenCommand(db, commandId)
  if (isRejection(command)) return command
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return reject(400, 'La quantité doit être un entier de 1 à 99')
  }
  const cleanedNote = cleanNote(note)
  if (isRejection(cleanedNote)) return cleanedNote
  if (db.prepare('SELECT id FROM dishes WHERE id = ?').get(dishId) === undefined) return reject(404, 'Plat inconnu')
  db
    .prepare('INSERT INTO lines (order_id, dish_id, quantity, note) VALUES (?, ?, ?, ?)')
    .run(commandId, dishId, quantity, cleanedNote)
  return readOrder(db, commandId)
}

function findLine(order: Order, lineId: number): OrderLine | Rejection {
  const line = order.lines.find((candidate) => candidate.id === lineId)
  return line === undefined ? reject(404, 'Ligne inconnue') : line
}

export function changeNote(db: DatabaseSync, commandId: number, lineId: number, note: string | null): Order | Rejection {
  const command = readOpenCommand(db, commandId)
  if (isRejection(command)) return command
  const line = findLine(command, lineId)
  if (isRejection(line)) return line
  if (line.status === 'cancelled') return reject(409, 'Ligne annulée')
  const cleanedNote = cleanNote(note)
  if (isRejection(cleanedNote)) return cleanedNote
  if (cleanedNote === line.note) return command
  db.prepare('UPDATE lines SET note = ? WHERE id = ?').run(cleanedNote, lineId)
  return readOrder(db, commandId)
}

export function cancelLine(db: DatabaseSync, orderId: number, lineId: number): Order | Rejection {
  const order = readOpenCommand(db, orderId)
  if (isRejection(order)) return order
  const line = findLine(order, lineId)
  if (isRejection(line)) return line
  if (line.status === 'draft') db.prepare('DELETE FROM lines WHERE id = ?').run(lineId)
  if (line.status === 'sent') db.prepare('UPDATE lines SET cancelled = 1 WHERE id = ?').run(lineId)
  return readOrder(db, orderId)
}

export function declareAllergies(db: DatabaseSync, orderId: number, allergies: string[]): Order | Rejection {
  const order = readOpenCommand(db, orderId)
  if (isRejection(order)) return order
  const kept: string[] = []
  for (const allergy of allergies) {
    const input = allergy.trim().toLowerCase()
    const allergen = input === 'oeuf' ? 'œuf' : input
    if (!ALLERGENS.includes(allergen)) {
      return reject(400, `Allergène inconnu : ${allergen}. Liste : ${ALLERGENS.join(', ')}`)
    }
    if (!kept.includes(allergen)) kept.push(allergen)
  }
  db.prepare('UPDATE orders SET allergies = ? WHERE id = ?').run(JSON.stringify(kept), orderId)
  return readOrder(db, orderId)
}

export function pay(db: DatabaseSync, commandId: number): Order | Rejection {
  const command = readOpenCommand(db, commandId)
  if (isRejection(command)) return command
  if (command.lines.some((line) => line.status === 'draft')) return reject(409, 'Il reste des lignes non envoyées')
  db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(commandId)
  return readOrder(db, commandId)
}
