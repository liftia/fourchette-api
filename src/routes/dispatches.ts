import { Hono } from 'hono'
import type { DatabaseSync } from 'node:sqlite'
import { readBill } from '../domain/bill.ts'
import { listDispatches, send } from '../domain/dispatches.ts'
import { isRejection } from '../rejection.ts'
import { parseId } from './body.ts'

export function dispatchRoutes(db: DatabaseSync): Hono {
  const routes = new Hono()

  routes.post('/orders/:id/send', (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return c.json({ error: 'Commande inconnue' }, 404)
    const ticket = send(db, id)
    if (isRejection(ticket)) return c.json({ error: ticket.error }, ticket.status)
    return c.json(ticket, 201)
  })

  routes.get('/orders/:id/bill', (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) return c.json({ error: 'Commande inconnue' }, 404)
    const slip = readBill(db, id)
    if (isRejection(slip)) return c.json({ error: slip.error }, slip.status)
    return c.json(slip)
  })

  routes.get('/dispatches', (c) => c.json(listDispatches(db)))

  return routes
}
