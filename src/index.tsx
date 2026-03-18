import { Hono } from 'hono'
import { users } from './db/schema.ts'
import { type Env, getDB } from './db/client.ts'
import { Layout } from './components/Layout.tsx'
import { TaskInputForm } from './components/TaskInputForm.tsx'
import { taskRoutes } from './routes/tasks.tsx'

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

taskRoutes(app)

export default app
