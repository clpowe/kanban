import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import app, {
  groupTasksByStatus,
  htmxDeleteResponse,
  htmxRefreshTasksResponse,
  sortTasksByPriority,
  TaskItem,
  TaskList
} from './index'

describe('htmxDeleteResponse', () => {
  test('returns an empty 200 response so htmx can apply hx-swap="delete"', async () => {
    const app = new Hono()

    app.delete('/task/:id', (c) => htmxDeleteResponse(c))

    const response = await app.request('/task/1', { method: 'DELETE' })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })
})

describe('htmxRefreshTasksResponse', () => {
  test('returns an empty 200 response with the refresh trigger header', async () => {
    const app = new Hono()

    app.patch('/task/:id', (c) => htmxRefreshTasksResponse(c))

    const response = await app.request('/task/1', { method: 'PATCH' })

    expect(response.status).toBe(200)
    expect(response.headers.get('HX-Trigger')).toBe('refreshTasks')
    expect(await response.text()).toBe('')
  })
})

describe('home page HTMX wiring', () => {
  test('listens for refreshTasks from the body on the tasks container', async () => {
    const response = await app.request('/')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('id="tasks-container"')
    expect(html).toContain('hx-trigger="load, refreshTasks from:body"')
  })
})

describe('groupTasksByStatus', () => {
  test('groups tasks without depending on Object.groupBy being available', () => {
    const originalGroupBy = Object.groupBy

    Object.assign(Object, { groupBy: undefined })

    try {
      const grouped = groupTasksByStatus([
        {
          id: 29,
          title: 'Review PR',
          priority: 'medium',
          value: 1,
          repeat: 'none',
          status: 'todo',
          assigneeId: 61
        },
        {
          id: 30,
          title: 'Ship fix',
          priority: 'high',
          value: 2,
          repeat: 'none',
          status: 'done',
          assigneeId: null
        }
      ])

      expect(grouped.todo).toHaveLength(1)
      expect(grouped.done).toHaveLength(1)
      expect(grouped.doing).toEqual([])
      expect(grouped.review).toEqual([])
    } finally {
      Object.assign(Object, { groupBy: originalGroupBy })
    }
  })
})

describe('sortTasksByPriority', () => {
  test('sorts tasks from high priority to low priority', () => {
    const sorted = sortTasksByPriority([
      {
        id: 1,
        title: 'Medium task',
        priority: 'medium',
        value: 1,
        repeat: 'none',
        status: 'todo',
        assigneeId: null
      },
      {
        id: 2,
        title: 'Low task',
        priority: 'low',
        value: 1,
        repeat: 'none',
        status: 'done',
        assigneeId: null
      },
      {
        id: 3,
        title: 'High task',
        priority: 'high',
        value: 1,
        repeat: 'none',
        status: 'doing',
        assigneeId: null
      }
    ])

    expect(sorted.map((task) => task.title)).toEqual([
      'High task',
      'Medium task',
      'Low task'
    ])
  })
})

describe('task assignee rendering', () => {
  test('renders assignee options from the users passed into TaskList', async () => {
    const app = new Hono()

    app.get('/task-list', (c) =>
      c.html(
        TaskList({
          tasks: [
            {
              id: 29,
              title: 'Review PR',
              priority: 'medium',
              value: 1,
              repeat: 'none',
              status: 'todo',
              assigneeId: 2
            }
          ],
          users: [
            { id: 1, name: 'Mom', points: 0, type: 'parent' },
            { id: 2, name: 'Emma', points: 0, type: 'child' }
          ]
        })
      )
    )

    const response = await app.request('/task-list')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('>Mom<')
    expect(html).toContain('>Emma<')
  })

  test('does not throw when TaskItem is rendered with no users prop', async () => {
    const app = new Hono()

    app.get('/task', (c) =>
      c.html(
        TaskItem({
          task: {
            id: 30,
            title: 'Ship fix',
            priority: 'high',
            value: 2,
            repeat: 'none',
            status: 'doing',
            assigneeId: null
          }
        })
      )
    )

    const response = await app.request('/task')

    expect(response.status).toBe(200)
  })
})

describe('task priority ordering', () => {
  test('renders tasks from high priority to low priority within each status column', async () => {
    const app = new Hono()

    app.get('/task-list', (c) =>
      c.html(
        TaskList({
          tasks: [
            {
              id: 1,
              title: 'Medium task',
              priority: 'medium',
              value: 1,
              repeat: 'none',
              status: 'todo',
              assigneeId: null
            },
            {
              id: 2,
              title: 'Low task',
              priority: 'low',
              value: 1,
              repeat: 'none',
              status: 'todo',
              assigneeId: null
            },
            {
              id: 3,
              title: 'High task',
              priority: 'high',
              value: 1,
              repeat: 'none',
              status: 'todo',
              assigneeId: null
            },
            {
              id: 4,
              title: 'Review medium task',
              priority: 'medium',
              value: 1,
              repeat: 'none',
              status: 'review',
              assigneeId: null
            },
            {
              id: 5,
              title: 'Review high task',
              priority: 'high',
              value: 1,
              repeat: 'none',
              status: 'review',
              assigneeId: null
            }
          ],
          users: []
        })
      )
    )

    const response = await app.request('/task-list')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('<h3>todo</h3>')
    expect(html).toContain('<h3>review</h3>')
    expect(html.indexOf('High task')).toBeLessThan(html.indexOf('Medium task'))
    expect(html.indexOf('Medium task')).toBeLessThan(html.indexOf('Low task'))
    expect(html.indexOf('Review high task')).toBeLessThan(html.indexOf('Review medium task'))
  })
})
