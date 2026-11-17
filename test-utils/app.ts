import type { Hono } from 'hono'
import { createApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function emptyApp(): Hono {
  return createApp(openDb('empty'))
}

export function serviceApp(): Hono {
  return createApp(openDb('service'))
}

export async function call<T>(app: Hono, method: Method, url: string, body?: unknown): Promise<{ status: number; body: T }> {
  const response = await app.request(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as T }
}
