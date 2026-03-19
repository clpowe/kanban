import { getCookie, setCookie } from 'hono/cookie'
import type { Hono } from 'hono'
import type { Env } from '../db/client'
import {
  FAMILY_SESSION_COOKIE,
  parseFamilySession,
  serializeFamilySession,
  validateActiveUserSelection,
} from '../auth/middleware'

export function sessionRoutes(app: Hono<Env>) {
  app.patch('/session/active-user', async (c) => {
    const body = await c.req.parseBody()
    const requestedUserId = Number(body.userId)
    const session = parseFamilySession(getCookie(c, FAMILY_SESSION_COOKIE))

    if (!session || Number.isNaN(requestedUserId)) {
      return c.text('Invalid session', 400)
    }

    try {
      const activeUserId = validateActiveUserSelection(session, requestedUserId)

      setCookie(
        c,
        FAMILY_SESSION_COOKIE,
        serializeFamilySession({
          activeUserId,
          familyUserIds: session.familyUserIds,
        }),
        {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
        }
      )
    } catch {
      return c.text('Invalid active user selection', 400)
    }

    c.header('HX-Refresh', 'true')
    return c.body(null, 204)
  })
}
