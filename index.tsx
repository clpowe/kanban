import { Hono } from 'hono'
import { users } from './src/db/schema.ts'
import { type Env, getDB } from './src/db/client.ts'
import { Layout } from './src/components/Layout.tsx'
import { TaskInputForm } from './src/components/TaskInputForm.tsx'
import { taskRoutes } from './src/routes/tasks.tsx'

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
