import { Hono } from 'hono'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { menuRoutes } from './routes/menu.ts'
import { orderRoutes } from './routes/orders.ts'
import { kitchenRoutes } from './routes/kitchen.ts'
import { dispatchRoutes } from './routes/dispatches.ts'

function defaultDb(): DatabaseSync {
  return openDb(process.env.DATA === 'empty' ? 'empty' : 'service')
}

export function createApp(db: DatabaseSync = defaultDb()): Hono {
  const app = new Hono()
  app.route('/api', menuRoutes(db))
  app.route('/api', orderRoutes(db))
  app.route('/api', dispatchRoutes(db))
  app.route('/api', kitchenRoutes())
  app.notFound((c) => c.json({ error: 'Route inconnue' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Erreur interne' }, 500)
  })
  return app
}
