import { Hono } from 'hono'
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'
import { users } from './schema'

export type Env = {
	Bindings: {
		DB: DrizzleD1Database
	}
}

const app = new Hono<Env>()

app.get('/', (c) => {
	return c.text('Hello Hono + D1 + Drizzle! Test')
})

app.get('/users', async (c) => {
	const db = drizzle(c.env.DB)
	const result = await db.select().from(users)
	return c.json(result)
})

app.post('/users', async (c) => {
	const body = await c.req.json()
	const db = drizzle(c.env.DB)

	const result = await db
		.insert(users)
		.values({
			name: body.name,
			email: body.email
		})
		.returning()

	return c.json(result)
})

export default app
