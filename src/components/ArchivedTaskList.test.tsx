import { describe, expect, test } from 'bun:test'
import { renderToString } from 'hono/jsx/dom/server'
import { ArchivedTaskList } from './ArchivedTaskList'
import type { Task, User } from '../types'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 0,
  type: 'parent',
  username: 'mom',
  passwordHash: 'hash'
} satisfies User

const childUser = {
  id: 2,
  name: 'Emma',
  points: 0,
  type: 'child',
  username: 'emma',
  passwordHash: 'hash'
} satisfies User

const archivedTasks = [
  {
    id: 4,
    title: 'Take out trash',
    priority: 'low',
    value: 1,
    status: 'archived',
    repeat: 'weekly',
    assigneeId: 2
  }
] satisfies Task[]

describe('ArchivedTaskList', () => {
  test('renders parent archive controls and a family filter', async () => {
    const html = await renderToString(
      <ArchivedTaskList
        tasks={archivedTasks}
        users={[parentUser, childUser]}
        authUser={parentUser}
        selectedAssigneeId={2}
      />
    )

    expect(html).toContain('Filter by family member')
    expect(html).toContain('name="assigneeIdFilter"')
    expect(html).toContain('name="status"')
  })

  test('renders archived tasks read-only for children', async () => {
    const html = await renderToString(
      <ArchivedTaskList
        tasks={archivedTasks}
        users={[parentUser, childUser]}
        authUser={childUser}
      />
    )

    expect(html).not.toContain('hx-patch="/task/4"')
    expect(html).toContain('Status: archived')
  })
})
