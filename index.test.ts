import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import app, { htmxDeleteResponse, htmxRefreshTasksResponse } from './index'

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
