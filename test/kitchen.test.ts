import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyApp, call } from '../test-utils/app.ts'

test('the two kitchen routes answer 501, not yet available', async () => {
  const app = emptyApp()
  for (const [method, url] of [['GET', '/api/kitchen/tickets'], ['POST', '/api/kitchen/tickets/1/advance']] as const) {
    const { status, body } = await call(app, method, url)
    assert.equal(status, 501, `${method} ${url}`)
    assert.deepEqual(body, { error: 'Pas encore disponible' })
  }
})
