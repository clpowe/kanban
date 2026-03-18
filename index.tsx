import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { tasks, users } from './src/db/schema.ts'
import type { TaskUpdate } from './src/types'
import {
	htmxDeleteResponse,
	htmxRefreshTasksResponse
} from './src/utils/htmx.ts'
import { eq } from 'drizzle-orm'
import { type Env, getDB } from './src/db/client.ts'
import { Layout } from './src/components/Layout.tsx'
import { TaskList } from './src/components/TaskList.tsx'
import { TaskItem } from './src/components/TaskItem.tsx'
import { TaskInputForm } from './src/components/TaskInputForm.tsx'

const app = new Hono<Env>()

app.get('/', async (c) => {
	const db = getDB(c.env)
	const usersRes = await db.select().from(users)

	return c.html(
		<Layout>
			<TaskInputForm users={usersRes} />
			<main
				id='tasks-container'
				hx-get='/tasks'
				hx-trigger='load, refreshTasks from:body'
				hx-swap='innerHTML'
			></main>
		</Layout>
	)
})

app.get('/users', async (c) => {
	const db = getDB(c.env)
	const result = await db.select().from(users)
})

app.get('/tasks', async (c) => {
	try {
		const db = getDB(c.env)
		const result = await db.select().from(tasks)
		const u = await db.select().from(users)

		return c.html(<TaskList tasks={result} users={u} />)
	} catch (err) {
		console.error('GET /tasks error:', err)

		return c.html(<div class='error'>Failed to load tasks</div>, 500)
	}
})

app.post('/tasks', async (c) => {
	const db = getDB(c.env)
	const body = await c.req.parseBody()

	await db.insert(tasks).values({
		title: body.title as string,
		priority: body.priority as any,
		value: Number(body.value),
		repeat: body.repeat as any,
		status: 'todo',
		assigneeId: body.assigneeId ? Number(body.assigneeId) : null
	})

	const u = await db.select().from(users)
	const result = await db.select().from(tasks)

	return c.html(<TaskList tasks={result} users={u} />)
})

app.patch('/task/:id/status', async (c) => {
	const id = Number(c.req.param('id'))
	const db = getDB(c.env)

	const body = await c.req.parseBody()
	const updates: any = {}

	if (body.status) updates.status = body.status

	await db.update(tasks).set(updates).where(eq(tasks.id, id))

	const result = await db.select().from(tasks)
	const u = await db.select().from(users)

	return c.html(<TaskList tasks={result} users={u} />)
})

app.patch('/task/:id', async (c) => {
	const id = Number(c.req.param('id'))
	console.log('PATCH /task/:id fired for', id)
	const db = getDB(c.env)

	const body = await c.req.parseBody()
	const updates: TaskUpdate = {}

	if (body.title) updates.title = body.title as string
	if (body.priority)
		updates.priority = body.priority as 'high' | 'medium' | 'low'
	if ('assigneeId' in body) {
		updates.assigneeId = body.assigneeId ? Number(body.assigneeId) : null
	}
	if (body.status) updates.status = body.status as any

	await db.update(tasks).set(updates).where(eq(tasks.id, id)).get()

	if (updates.status) {
		return htmxRefreshTasksResponse(c)
	}

	const u = await db.select().from(users)
	const task = await db.select().from(tasks).where(eq(tasks.id, id)).get()

	return c.html(<TaskItem task={task} users={u} />)
})

app.delete('/task/:id', async (c) => {
	const id = Number(c.req.param('id'))
	const db = getDB(c.env)
	await db.delete(tasks).where(eq(tasks.id, id))
	return htmxDeleteResponse(c)
})

export default app
