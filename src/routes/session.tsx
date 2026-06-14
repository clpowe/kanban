import { getCookie, setCookie } from 'hono/cookie'
import type { Hono } from 'hono'
import type { Env } from '../db/client'
import {
  FAMILY_SESSION_COOKIE,
  parseFamilySession,
  serializeFamilySession,
  validateActiveUserSelection,
} from '../auth/middleware'
import { createPostHogClient } from '../lib/posthog'

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

      const loginUser = c.get('loginUser')
      if (loginUser) {
        const posthog = createPostHogClient(c.env)
        await posthog.captureImmediate({
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
