import { getCookie, setCookie } from 'hono/cookie'
import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'
import {
  FAMILY_SESSION_COOKIE,
  parseFamilySession,
  serializeFamilySession,
  validateActiveUserSelection,
} from '../auth/middleware'
import {
  getRequestExecutionContext,
  queuePostHogTelemetry,
} from '../lib/posthog'

export function sessionRoutes(app: Hono<Env>) {
  // 1. GET current authenticated session & active user (Crucial for client boot!)
  app.get('/session/active-user', async (c) => {
    const activeUser = c.get('activeUser')
    if (!activeUser) {
      return c.text('Not authenticated', 401)
    }
    return c.json({
      user: activeUser
    })
  })

  // 2. PATCH switch current active family member
  app.patch('/session/active-user', async (c) => {
    try {
      const body = await c.req.json()
      const requestedUserId = Number(body.userId)
      const session = parseFamilySession(getCookie(c, FAMILY_SESSION_COOKIE))

      if (!session || Number.isNaN(requestedUserId)) {
        return c.json({ error: 'Invalid session' }, 400)
      }

      const loginUser = c.get('loginUser')

      // Enforce: Children cannot switch to parent accounts
      if (loginUser && loginUser.type === 'child') {
        const db = getDB(c.env)
        const targetUser = await db
          .select()
          .from(users)
          .where(eq(users.id, requestedUserId))
          .get()

        if (targetUser && targetUser.type === 'parent') {
          return c.json({ error: 'Forbidden: Children cannot switch to parent accounts' }, 403)
        }
      }

      const activeUserId = validateActiveUserSelection(session, requestedUserId)

      setCookie(
        c,
        FAMILY_SESSION_COOKIE,
        serializeFamilySession({
          loginUserId: loginUser ? loginUser.id : session.loginUserId,
          activeUserId,
          familyUserIds: session.familyUserIds,
        }),
        {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
        }
      )

      if (loginUser) {
        queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
          type: 'capture',
          distinctId: String(loginUser.id),
          event: 'active user switched',
          properties: { new_active_user_id: activeUserId },
        })
      }

      return c.json({ success: true, activeUserId })
    }
    catch (err) {
      console.error('PATCH active-user session error:', err)
      return c.json({ error: 'Invalid active user selection' }, 400)
    }
  })
}
