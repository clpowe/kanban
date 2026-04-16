import { describe, expect, test } from 'bun:test'
import { renderToString } from 'hono/jsx/dom/server'
import type { Task, User } from '../types'
import { ArchivedTaskList } from './ArchivedTaskList'
import { TaskInputForm } from './TaskInputForm'
import { TaskList } from './TaskList'
import { UsersList } from './UserList'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 24,
  type: 'parent',
  username: 'mom',
  passwordHash: 'hash',
} satisfies User

const childUser = {
  id: 2,
  name: 'Emma',
  points: 12,
  type: 'child',
  username: 'emma',
  passwordHash: 'hash',
} satisfies User

const tasks = [
  {
    id: 10,
    title: 'Unload dishwasher',
    priority: 'high',
    status: 'todo',
    assigneeId: 2,
    repeat: 'daily',
    value: 3,
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
    dueDate: null,
  },
] satisfies Task[]

describe('calm board styling', () => {
  test('renders the task form as a DaisyUI card with styled controls', async () => {
    const form = await TaskInputForm({ users: [parentUser, childUser] })
    const html = await renderToString(form)

    expect(html).toContain('class="card bg-base-100 shadow-sm"')
    expect(html).toContain('class="input input-bordered w-full md:col-span-2 xl:col-span-2"')
    expect(html).toContain('class="select select-bordered w-full"')
    expect(html).toContain('class="btn btn-primary"')
  })

  test('renders task lanes as a responsive card grid', async () => {
    const html = await renderToString(
      <TaskList tasks={tasks} users={[parentUser, childUser]} authUser={parentUser} />
    )

    expect(html).toContain('class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"')
    expect(html).toContain('class="card bg-base-100 shadow-sm border border-base-300"')
    expect(html).toContain('class="badge badge-outline"')
    expect(html).toContain('class="card bg-base-100 border border-base-300 shadow-sm"')
    expect(html).not.toContain('>archived<')
  })

  test('renders the user summary as a companion card', async () => {
    const html = await renderToString(<UsersList users={[parentUser, childUser]} />)

    expect(html).toContain('class="card bg-base-100 shadow-sm border border-base-300"')
    expect(html).toContain('class="badge badge-primary badge-soft"')
    expect(html).toContain('Family Score')
  })

  test('renders archived tasks in a dedicated filtered panel', async () => {
    const html = await renderToString(
      <ArchivedTaskList tasks={tasks as Task[]} users={[parentUser, childUser]} authUser={parentUser} />
    )

    expect(html).toContain('Archived Tasks')
    expect(html).toContain('All family members')
    expect(html).toContain('hx-get="/archived/tasks"')
  })
})
