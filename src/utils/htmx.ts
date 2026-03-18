import type { Context } from 'hono'

export const htmxDeleteResponse = (c: Context) => c.body('', 200)

export const htmxRefreshTasksResponse = (c: Context) => {
  c.header('HX-Trigger', 'refreshTasks')
  return c.body('', 200)
}

export const htmxRefreshUsersResponse = (c: Context) => {
  c.header('HX-Trigger', 'refreshUsers')
  return c.body('', 200)
}
