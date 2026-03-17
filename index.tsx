import { Hono } from 'hono'
import type { Context } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { tasks, users } from './schema'
import { Fragment, type FC } from 'hono/jsx'
import type { User, Task } from './types'
import { eq } from 'drizzle-orm'

export type Env = {
  Bindings: {
    family_kanban: D1Database
  }
}

const app = new Hono<Env>()

export const htmxDeleteResponse = (c: Context) => c.body('', 200)
export const htmxRefreshTasksResponse = (c: Context) => {
  c.header('HX-Trigger', 'refreshTasks')
  return c.body('', 200)
}

const TASK_STATUSES: Task['status'][] = ['todo', 'doing', 'review', 'done']

export const groupTasksByStatus = (taskList: Task[]) =>
  taskList.reduce<Record<Task['status'], Task[]>>(
    (grouped, task) => {
      grouped[task.status].push(task)
      return grouped
    },
    {
      todo: [],
      doing: [],
      review: [],
      done: []
    }
  )

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
          <li key={u.id} data-id={u.id}>{u.name}</li>
        ))}
      </ul>
    </Fragment>
  )
}

const TaskList: FC<{ tasks: Task[] }> = ({ tasks }) => {
  const grouped = groupTasksByStatus(tasks)

  return (
    <>
      {TASK_STATUSES.map((status) => (
        <div key={status}>
          <h3>{status}</h3>
          <ul>
            {(grouped[status!!] ?? []).map((task) => (
              <Task task={task} />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

const Task: FC<{ task: Task }> = ({ task }) => {
  return (
    <li key={task.id} data-id={task.id}>
      <form
        hx-patch={`/task/${task.id}`}
        hx-trigger="change from:input, change from:select, consume"
        hx-target="closest li"
        hx-swap="outerHTML"
      >
        <input type="text" value={task.title} />
        <select
          name="priority"
        >
          <option value="low" selected={task.priority === "low"}>Low</option>
          <option value="medium" selected={task.priority === "medium"}>Medium</option>
          <option value="high" selected={task.priority === "high"}>High</option>
        </select>

        <select name="assigneeId">
          <option value="">Unassigned</option>
          <option value="61" selected={task.assigneeId === 61}>Mom</option>
          <option value="62" selected={task.assigneeId === 62}>Dad</option>
          <option value="63" selected={task.assigneeId === 63}>Emma</option>
          <option value="64" selected={task.assigneeId === 64}>Noah</option>
        </select>
      </form>

      <select
        name="status"
        hx-patch={`/task/status/${task.id}`}
        hx-trigger="change"
        hx-swap="innerHTML"
        hx-target='#tasks-container'
      >
        <option value="todo" selected={task.status === 'todo'}>todo</option>
        <option value="doing" selected={task.status === 'doing'}>doing</option>
        <option value="review" selected={task.status === 'review'}>review</option>
        <option value="done" selected={task.status === 'done'}>done</option>
      </select>
      <button
        hx-delete={`/task/${task.id}`}
        hx-target="closest li"
        hx-swap="delete "
        hx-trigger="click"
      >Delete</button>
    </li>
  )
}

app.get('/', (c) => {
  console.log('Root Request')
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
      <div
        id='tasks-container'
        hx-get='/tasks'
        hx-trigger='load, refreshTasks from:body'
        hx-swap='innerHTML'
      ></div>
    </Layout>
  )
})

app.get('/users', async (c) => {
  const db = drizzle(c.env.family_kanban)
  const result = await db.select().from(users)
  return c.html(<UserList users={result} />)
})

app.get('/tasks', async (c) => {
  try {
    const db = drizzle(c.env.family_kanban)
    const result = await db.select().from(tasks)

    return c.html(<TaskList tasks={result} />)
  } catch (err) {
    console.error('GET /tasks error:', err)

    return c.html(
      <div class="error">
        Failed to load tasks
        <p>
          {
            err
          }
        </p>
      </div>,
      500
    )
  }
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

app.patch('/task/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const db = drizzle(c.env.family_kanban)

  const body = await c.req.parseBody()
  const updates: any = {}

  if (body.title) updates.title = body.title
  if (body.priority) updates.priority = body.priority
  if ('assigneeId' in body) {
    updates.assigneeId = body.assigneeId ? Number(body.assigneeId) : null
  }
  if (body.status) updates.status = body.status

  await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))

  if (updates.status) {
    c.header('HX-Trigger', 'refreshTasks')
    return c.body('', 200)
  }

  const task = await db.select().from(tasks).where(eq(tasks.id, id)).get()
  return c.html(<Task task={task} />)
})

app.patch('/task/status/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const db = drizzle(c.env.family_kanban)

  const body = await c.req.parseBody()
  const updates: any = {}

  if (body.status) updates.status = body.status

  await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))

  const result = await db.select().from(tasks)

  return c.html(<TaskList tasks={result} />)
})


app.delete('/task/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const db = drizzle(c.env.family_kanban)
  await db.delete(tasks).where(eq(tasks.id, id))
  return htmxDeleteResponse(c)
})

export default app
