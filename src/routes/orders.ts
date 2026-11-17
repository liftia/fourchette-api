import { Hono } from 'hono'
import type { Context } from 'hono'
import type { DatabaseSync } from 'node:sqlite'
import {
  addLine,
  cancelLine,
  changeNote,
  declareAllergies,
  openOrder,
  pay,
  readOrder,
} from '../domain/orders.ts'
import { isRejection, reject } from '../rejection.ts'
import type { Rejection } from '../rejection.ts'
import type { Order } from '../types.ts'
import { parseId, readBody } from './body.ts'

const MALFORMED = reject(400, 'Requête mal formée')
const UNKNOWN_ORDER = reject(404, 'Commande inconnue')
const UNKNOWN_LINE = reject(404, 'Ligne inconnue')

function respond(c: Context, result: Order | Rejection, status: 200 | 201 = 200): Response {
  if (isRejection(result)) return c.json({ error: result.error }, result.status)
  return c.json(result, status)
}

function readNote(body: Record<string, unknown>): string | null | Rejection {
  const note = body.note
  if (note === undefined || note === null) return null
  return typeof note === 'string' ? note : MALFORMED
}

export function orderRoutes(db: DatabaseSync): Hono {
  const routes = new Hono()

  routes.post('/orders', async (c) => {
    const body = await readBody(c)
    if (body === null || typeof body.table !== 'number' || !Number.isInteger(body.table)) {
      return respond(c, MALFORMED)
    }
    return respond(c, openOrder(db, body.table), 201)
  })

  routes.get('/orders/:id', (c) => {
    const id = parseId(c.req.param('id'))
    return respond(c, id === null ? UNKNOWN_ORDER : readOrder(db, id))
  })

  routes.post('/orders/:id/lines', async (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return respond(c, UNKNOWN_ORDER)
    const body = await readBody(c)
    if (body === null || typeof body.dishId !== 'number' || !Number.isInteger(body.dishId)) {
      return respond(c, MALFORMED)
    }
    const note = readNote(body)
    if (isRejection(note)) return respond(c, note)
    const quantity = typeof body.quantity === 'number' ? body.quantity : Number.NaN
    return respond(c, addLine(db, id, body.dishId, quantity, note), 201)
  })

  routes.patch('/orders/:id/lines/:lineId', async (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return respond(c, UNKNOWN_ORDER)
    const lineId = parseId(c.req.param('lineId'))
    if (lineId === null) return respond(c, UNKNOWN_LINE)
    const body = await readBody(c)
    if (body === null || !('note' in body)) return respond(c, MALFORMED)
    const note = readNote(body)
    if (isRejection(note)) return respond(c, note)
    return respond(c, changeNote(db, id, lineId, note))
  })

  routes.delete('/orders/:id/lines/:lineId', (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return respond(c, UNKNOWN_ORDER)
    const lineId = parseId(c.req.param('lineId'))
    if (lineId === null) return respond(c, UNKNOWN_LINE)
    return respond(c, cancelLine(db, id, lineId))
  })

  routes.put('/orders/:id/allergies', async (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return respond(c, UNKNOWN_ORDER)
    const body = await readBody(c)
    const allergies = body?.allergies
    if (!Array.isArray(allergies) || !allergies.every((value) => typeof value === 'string')) {
      return respond(c, MALFORMED)
    }
    return respond(c, declareAllergies(db, id, allergies))
  })

  routes.post('/orders/:id/pay', (c) => {
    const id = parseId(c.req.param('id'))
    return respond(c, id === null ? UNKNOWN_ORDER : pay(db, id))
  })

  return routes
}
