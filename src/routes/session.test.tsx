import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { sessionRoutes } from './session'
import { FAMILY_SESSION_COOKIE, serializeFamilySession } from '../auth/middleware'
import type { Env } from '../db/client'

describe('sessionRoutes', () => {
  test('updates the active user in the family session cookie', async () => {
    const app = new Hono<Env>()
    sessionRoutes(app)

    const response = await app.request('/session/active-user', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `${FAMILY_SESSION_COOKIE}=${encodeURIComponent(
          serializeFamilySession({
            activeUserId: 1,
            familyUserIds: [1, 2],
          })
        )}`,
      },
      body: new URLSearchParams({ userId: '2' }).toString(),
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('HX-Refresh')).toBe('true')
    expect(decodeURIComponent(response.headers.get('set-cookie') ?? '')).toContain(
      '"activeUserId":2'
    )
  })

  test('rejects switching to a user outside the family session', async () => {
    const app = new Hono<Env>()
    sessionRoutes(app)

    const response = await app.request('/session/active-user', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `${FAMILY_SESSION_COOKIE}=${encodeURIComponent(
          serializeFamilySession({
            activeUserId: 1,
            familyUserIds: [1],
          })
        )}`,
      },
      body: new URLSearchParams({ userId: '2' }).toString(),
    })

    expect(response.status).toBe(400)
  })
})
