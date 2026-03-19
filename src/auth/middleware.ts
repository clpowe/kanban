import { basicAuth } from 'hono/basic-auth'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import type { User } from '../types'
import { canManageTask, canUpdateTaskStatus } from './authorization'
import { verifyPassword } from './password'
import { getTaskAssigneeId, getUserByUsername } from '../services/user.service'

export const authMiddleware = basicAuth({
  realm: 'Family Kanban',
  invalidUserMessage: 'Invalid username or password',
  verifyUser: async (username, password, c) => {
    const db = getDB(c.env)
    const user = await getUserByUsername(db, username)

    if (!user?.passwordHash) {
      return false
    }

    const isValid = await verifyPassword(password, user.passwordHash)

    if (isValid) {
      c.set('authUser', user)
    }

    return isValid
  },
})

export function requireAuthenticatedUser(c: Context<Env>): User {
  const authUser = c.get('authUser')

  if (!authUser) {
    throw new Error('Authenticated user missing from context')
  }

  return authUser
}

export function requireParent(c: Context<Env>): User {
  const authUser = requireAuthenticatedUser(c)

  if (!canManageTask(authUser)) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  return authUser
}

export async function requireChildOwnTaskAccess(
  c: Context<Env>,
  taskId: number
): Promise<User> {
  const authUser = requireAuthenticatedUser(c)

  if (authUser.type === 'parent') {
    return authUser
  }

  const db = getDB(c.env)
  const assigneeId = await getTaskAssigneeId(db, taskId)

  if (!canUpdateTaskStatus(authUser, assigneeId)) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  return authUser
}
