import { Hono } from 'hono'

const NOT_YET = { error: 'Pas encore disponible' }

export function kitchenRoutes(): Hono {
  const routes = new Hono()

  routes.get('/kitchen/tickets', (c) => c.json(NOT_YET, 501))

  routes.post('/kitchen/tickets/:id/advance', (c) => c.json(NOT_YET, 501))

  return routes
}
