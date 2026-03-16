import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { tasks, users } from './schema'
import { Fragment, type FC } from 'hono/jsx'
import type { User, Task } from './types'

export type Env = {
	Bindings: {
		family_kanban: D1Database
	}
}

const app = new Hono<Env>()

const Layout: FC = (props) => {
	return (
		<html>
			<head>
				<title>Family Task</title>
				<script
					src='https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js'
					integrity='sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz'
					crossorigin='anonymous'
				></script>
				<script src='https://unpkg.com/hyperscript.org@0.9.14'></script>
			</head>
			<body>{props.children}</body>
		</html>
	)
}

const UserList: FC<{ users: User[] }> = ({ users }) => {
	return (
		<Fragment>
			<ul>
				{users?.map((u) => (
					<li key={u.id}>{u.name}</li>
				))}
			</ul>
		</Fragment>
	)
}

const TaskList: FC<{ tasks: Task[] }> = ({ tasks }) => {
	const grouped = Object.groupBy(tasks, (t) => t.status!!)

	const columns: Task['status'][] = ['todo', 'doing', 'review', 'done']

	return (
		<>
			{columns.map((status) => (
				<div key={status}>
					<h3>{status}</h3>

					<ul>
						{(grouped[status!!] ?? []).map((task) => (
							<li key={task.id}>{task.title}</li>
						))}
					</ul>
				</div>
			))}
		</>
	)
}

app.get('/', (c) => {
	return c.html(
		<Layout>
			Hello from hono
			<form
				hx-post='/tasks'
				hx-target='#tasks-container'
				hx-swap='innerHTML'
				hx-on--after-request='if(event.detail.successful) this.reset()'
			>
				<input type='text' name='title' placeholder='Enter a task' required />

				<select name='priority'>
					<option value='low'>Low</option>
					<option value='medium' selected>
						Medium
					</option>
					<option value='high'>High</option>
				</select>

				<input type='number' name='value' placeholder='Points' min='1' />

				<select name='repeat'>
					<option value='none'>No Repeat</option>
					<option value='daily'>Daily</option>
					<option value='weekly'>Weekly</option>
				</select>

				<select name='assigneeId'>
					<option value=''>Unassigned</option>
					<option value='61'>Mom</option>
					<option value='62'>Dad</option>
					<option value='63'>Emma</option>
					<option value='64'>Noah</option>
				</select>

				<button type='submit'>Add Task</button>
			</form>
			<div hx-get='/users' hx-trigger='load' hx-target='#user-container'></div>
			<div id='user-container'></div>
			<div hx-get='/tasks' hx-trigger='load' hx-target='#tasks-container'></div>
			<div id='tasks-container'></div>
		</Layout>
	)
})

app.get('/users', async (c) => {
	const db = drizzle(c.env.family_kanban)
	const result = await db.select().from(users)
	return c.html(<UserList users={result} />)
})

app.get('/tasks', async (c) => {
	const db = drizzle(c.env.family_kanban)
	const result = await db.select().from(tasks)
	return c.html(<TaskList tasks={result} />)
})

app.post('/tasks', async (c) => {
	const db = drizzle(c.env.family_kanban)
	const body = await c.req.parseBody()

	await db.insert(tasks).values({
		title: body.title as string,
		priority: body.priority as any,
		value: Number(body.value),
		repeat: body.repeat as any,
		status: 'todo',
		assigneeId: body.assigneeId ? Number(body.assigneeId) : null
	})

	const result = await db.select().from(tasks)

	return c.html(<TaskList tasks={result} />)
})

export default app
