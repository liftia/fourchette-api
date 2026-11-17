import { Hono } from 'hono'
import type { DatabaseSync } from 'node:sqlite'
import { readMenu, readTables } from '../domain/menu.ts'

export function menuRoutes(db: DatabaseSync): Hono {
  const routes = new Hono()
  routes.get('/health', (c) => c.json({ ok: true }))
  routes.get('/menu', (c) => c.json(readMenu(db)))
  routes.get('/tables', (c) => c.json(readTables(db)))
  return routes
}
