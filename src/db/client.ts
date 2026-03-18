import { drizzle } from 'drizzle-orm/d1'

export type Env = {
  Bindings: {
    family_kanban: D1Database
  }
}


export function getDB(env: Env['Bindings']) {
  return drizzle(env.family_kanban)
}
