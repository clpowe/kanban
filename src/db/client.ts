import { drizzle } from 'drizzle-orm/d1'
import type { User } from '../types'

export type Env = {
  Bindings: {
    family_kanban: D1Database
  }
  Variables: {
    authUser: User
  }
}


export function getDB(env: Env['Bindings']) {
  return drizzle(env.family_kanban)
}
