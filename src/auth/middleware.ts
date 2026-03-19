import { basicAuth } from 'hono/basic-auth'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import type { User } from '../types'
import { canManageTask, canUpdateTaskStatus } from './authorization'
import { verifyPassword } from './password'
import {
  getAllUsers,
  getTaskAssigneeId,
  getUserByUsername,
} from '../services/user.service'

export const FAMILY_SESSION_COOKIE = 'family_session'

export type FamilySession = {
  activeUserId: number
  familyUserIds: number[]
}

export function serializeFamilySession(session: FamilySession): string {
  return JSON.stringify(session)
}

export function parseFamilySession(
  value: string | undefined | null
): FamilySession | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<FamilySession>

    if (
      typeof parsed.activeUserId !== 'number' ||
      !Array.isArray(parsed.familyUserIds) ||
      parsed.familyUserIds.some((id) => typeof id !== 'number')
    ) {
      return null
    }

    return {
      activeUserId: parsed.activeUserId,
      familyUserIds: parsed.familyUserIds,
    }
  } catch {
    return null
  }
}

export function resolveActiveUser(
  users: User[],
  loginUser: User,
  sessionValue: string | undefined | null
): User {
  const session = parseFamilySession(sessionValue)

  if (!session) {
    return loginUser
  }

  if (!session.familyUserIds.includes(session.activeUserId)) {
    return loginUser
  }

  const activeUser = users.find((user) => user.id === session.activeUserId)

  return activeUser ?? loginUser
}

export function validateActiveUserSelection(
  session: FamilySession,
  requestedUserId: number
): number {
  if (!session.familyUserIds.includes(requestedUserId)) {
    throw new Error('Invalid active user selection')
  }

  return requestedUserId
}

const basicAuthMiddleware = basicAuth({
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

export const authMiddleware = async (c: Context<Env>, next: () => Promise<void>) => {
  await basicAuthMiddleware(c, async () => {})

  const loginUser = c.get('authUser')

  if (!loginUser) {
    throw new Error('Authenticated user missing from context')
  }

  const db = getDB(c.env)
  const users = await getAllUsers(db)
  const sessionValue = getCookie(c, FAMILY_SESSION_COOKIE)
  const activeUser = resolveActiveUser(users, loginUser, sessionValue)
  const nextSession = serializeFamilySession({
    activeUserId: activeUser.id,
    familyUserIds: users.map((user) => user.id),
  })

  setCookie(c, FAMILY_SESSION_COOKIE, nextSession, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  })

  c.set('loginUser', loginUser)
  c.set('activeUser', activeUser)
  c.set('authUser', activeUser)

  await next()
}

export function requireAuthenticatedUser(c: Context<Env>): User {
  const authUser = c.get('activeUser')

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
