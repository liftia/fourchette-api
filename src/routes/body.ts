import type { Context } from 'hono'

export async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

export function parseId(text: string): number | null {
  return /^[1-9][0-9]{0,8}$/.test(text) ? Number(text) : null
}
