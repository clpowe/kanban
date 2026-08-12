import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { sessionRoutes } from './session'
import { FAMILY_SESSION_COOKIE, serializeFamilySession } from '../auth/middleware'
import type { Env } from '../db/client'
import type { User } from '../types'

describe('sessionRoutes', () => {
  test('returns the active user with its reconciled point balance', async () => {
    const activeUser = {
      id: 2,
      name: 'Child',
      email: 'child@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date('2026-08-12T12:00:00Z'),
      updatedAt: new Date('2026-08-12T12:00:00Z'),
      points: 20,
      type: 'child',
      username: 'child',
      displayUsername: 'Child',
    } satisfies User
    const app = new Hono<Env>()
    app.use('*', async (c, next) => {
      c.set('activeUser', activeUser)
      await next()
    })
    sessionRoutes(app)

    const response = await app.request('/session/active-user')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      user: expect.objectContaining({ id: activeUser.id, points: 20 }),
    })
  })

  test('updates the active user in the family session cookie', async () => {
    const app = new Hono<Env>()
    sessionRoutes(app)

    const response = await app.request('/session/active-user', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${FAMILY_SESSION_COOKIE}=${encodeURIComponent(
          serializeFamilySession({
            loginUserId: 1,
            activeUserId: 1,
            familyUserIds: [1, 2],
          })
        )}`,
      },
      body: JSON.stringify({ userId: 2 }),
    })

    expect(response.status).toBe(200)
    expect(decodeURIComponent(response.headers.get('set-cookie') ?? '')).toContain(
      '"activeUserId":2'
    )
    const json = await response.json()
    expect(json).toEqual({ success: true, activeUserId: 2 })
  })

  test('rejects switching to a user outside the family session', async () => {
    const app = new Hono<Env>()
    sessionRoutes(app)

    const response = await app.request('/session/active-user', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${FAMILY_SESSION_COOKIE}=${encodeURIComponent(
          serializeFamilySession({
            loginUserId: 1,
            activeUserId: 1,
            familyUserIds: [1],
          })
        )}`,
      },
      body: JSON.stringify({ userId: 2 }),
    })

    expect(response.status).toBe(400)
  })
})
