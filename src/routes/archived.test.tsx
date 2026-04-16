import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { Env } from '../db/client'
import { archivedRoutes, parseSelectedAssigneeId } from './archived'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 0,
  type: 'parent' as const,
  username: 'mom',
  passwordHash: 'hash'
}

const childUser = {
  id: 2,
  name: 'Emma',
  points: 10,
  type: 'child' as const,
  username: 'emma',
  passwordHash: 'hash'
}

const archivedTasks = [
  {
    id: 8,
    title: 'Fold laundry',
    priority: 'medium' as const,
    value: 5,
    status: 'archived' as const,
    repeat: 'none' as const,
    assigneeId: 2
  }
]

describe('parseSelectedAssigneeId', () => {
  test('falls back to all when the assignee id is invalid', () => {
    expect(parseSelectedAssigneeId('99', [parentUser, childUser])).toBeNull()
    expect(parseSelectedAssigneeId('all', [parentUser, childUser])).toBeNull()
  })
})

describe('archivedRoutes', () => {
  test('renders the archived page shell for any authenticated family user', async () => {
    const app = new Hono<Env>()
    archivedRoutes(app, {
      getDB() {
        return {} as any
      },
      requireAuthenticatedUser() {
        return childUser
      },
      getAllUsers: async () => [parentUser, childUser],
      getArchivedTasks: async () => archivedTasks
    })

    const response = await app.request('/archived')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('hx-get="/archived/tasks"')
    expect(html).toContain('>Archive<')
  })

  test('filters archived tasks by family member when a valid assignee is requested', async () => {
    let archivedCall: number | null | undefined
    const app = new Hono<Env>()
    archivedRoutes(app, {
      getDB() {
        return {} as any
      },
      requireAuthenticatedUser() {
        return parentUser
      },
      getAllUsers: async () => [parentUser, childUser],
      getArchivedTasks: async (_db, assigneeId) => {
        archivedCall = assigneeId
        return archivedTasks
      }
    })

    const response = await app.request('/archived/tasks?assigneeId=2')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(archivedCall).toBe(2)
    expect(html).toContain('Fold laundry')
    expect(html).toContain('All family members')
  })
})
