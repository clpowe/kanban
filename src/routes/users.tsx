import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import { requireParent } from '../auth/middleware'
import { getAllUsers } from '../services/user.service'

export function userRoutes(app: Hono<Env>) {
  // GET list of all users (sorted)
  app.get('/api/users', async (c) => {
    try {
      const db = getDB(c.env)
      const result = await getAllUsers(db)
      const sortedUsers = [...result].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'child' ? -1 : 1
        }

        if (a.points !== b.points) {
          return b.points - a.points
        }

        return a.name.localeCompare(b.name)
      })

      return c.json(sortedUsers)
    } catch (error) {
      console.error('GET /api/users error:', error)
      return c.json({ error: 'Failed to load users' }, 500)
    }
  })

  // 2. PATCH user details (Parents only - Stub)
  app.patch('/api/users/:id', async (c) => {
    try {
      requireParent(c)
      return c.json({ error: 'Not implemented' }, 501)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })
}
