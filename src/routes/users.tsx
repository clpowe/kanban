import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import { requireParent } from '../auth/middleware'
import { getAllUsers } from '../services/user.service'
import { UsersList } from '../components/UserList'

export function userRoutes(app: Hono<Env>) {
	app.get('/users', async (c) => {
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

		return c.html(<UsersList users={sortedUsers} />)
	})
	app.patch('/users/:id', async (c) => {
		requireParent(c)
		return c.text('Not implemented', 501)
	})
}
