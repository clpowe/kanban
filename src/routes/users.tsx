import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import { getAllUsers } from '../services/user.service'
import { UsersList } from '../components/UserList'

export function userRoutes(app: Hono<Env>) {
	app.get('/users', async (c) => {
		const db = getDB(c.env)
		const result = await getAllUsers(db)

		return c.html(<UsersList users={result} />)
	})
	app.patch('/users/:id', async (c) => {
		const id = Number(c.req.param('id'))
		const db = getDB(c.env)
	})
}
