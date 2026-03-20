import type { Context } from 'hono'

export const htmxDeleteResponse = (c: Context) => c.body('', 200)

export const htmxRefreshResponse = (
  c: Context,
  triggers: string | string[]
) => {
  const names = Array.isArray(triggers) ? triggers : [triggers]
  const payload = names.length === 1 ? names[0] : JSON.stringify(names.reduce<Record<string, true>>((acc, name) => {
    acc[name] = true
    return acc
  }, {}))
  c.header('HX-Trigger', payload)
  return c.body('', 200)
}

export const htmxRefreshTasksResponse = (c: Context) => {
  return htmxRefreshResponse(c, 'refreshTasks')
}

export const htmxRefreshUsersResponse = (c: Context) => {
  return htmxRefreshResponse(c, 'refreshUsers')
}
