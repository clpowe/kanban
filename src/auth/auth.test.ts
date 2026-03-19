import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from './password'
import { canManageTask, canUpdateTaskStatus } from './authorization'
import {
  parseFamilySession,
  requireAuthenticatedUser,
  requireParent,
  resolveActiveUser,
  serializeFamilySession,
  validateActiveUserSelection,
} from './middleware'
import type { User } from '../types'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 0,
  type: 'parent',
  username: 'mom',
  passwordHash: 'hash',
} satisfies User

const childUser = {
  id: 2,
  name: 'Emma',
  points: 0,
  type: 'child',
  username: 'emma',
  passwordHash: 'hash',
} satisfies User

describe('password auth helpers', () => {
  test('hashes and verifies a password', async () => {
    const hash = await hashPassword('family-secret')

    expect(hash).not.toBe('family-secret')
    await expect(verifyPassword('family-secret', hash)).resolves.toBe(true)
  })

  test('rejects an invalid password', async () => {
    const hash = await hashPassword('family-secret')

    await expect(verifyPassword('not-it', hash)).resolves.toBe(false)
  })
})

describe('authorization helpers', () => {
  test('parents can manage tasks', () => {
    expect(canManageTask(parentUser)).toBe(true)
    expect(canManageTask(childUser)).toBe(false)
  })

  test('children can only update status for their own assigned tasks', () => {
    expect(canUpdateTaskStatus(parentUser, 99)).toBe(true)
    expect(canUpdateTaskStatus(childUser, childUser.id)).toBe(true)
    expect(canUpdateTaskStatus(childUser, parentUser.id)).toBe(false)
    expect(canUpdateTaskStatus(childUser, null)).toBe(false)
  })
})

describe('family session helpers', () => {
  const users = [parentUser, childUser]

  test('serializes and parses the family session cookie payload', () => {
    const serialized = serializeFamilySession({
      activeUserId: childUser.id,
      familyUserIds: users.map((user) => user.id),
    })

    expect(parseFamilySession(serialized)).toEqual({
      activeUserId: childUser.id,
      familyUserIds: [parentUser.id, childUser.id],
    })
  })

  test('resolves the active user from session state when present', () => {
    const activeUser = resolveActiveUser(
      users,
      parentUser,
      serializeFamilySession({
        activeUserId: childUser.id,
        familyUserIds: users.map((user) => user.id),
      })
    )

    expect(activeUser).toEqual(childUser)
  })

  test('falls back to the login user when session state is missing', () => {
    expect(resolveActiveUser(users, parentUser, undefined)).toEqual(parentUser)
  })

  test('rejects switching to a user outside the family session', () => {
    expect(() =>
      validateActiveUserSelection(
        {
          activeUserId: parentUser.id,
          familyUserIds: [parentUser.id],
        },
        childUser.id
      )
    ).toThrow('Invalid active user selection')
  })

  test('request auth resolves the active user instead of the login user', () => {
    const context = {
      get(key: string) {
        if (key === 'authUser') {
          return parentUser
        }

        if (key === 'activeUser') {
          return childUser
        }

        return undefined
      },
    } as any

    expect(requireAuthenticatedUser(context)).toEqual(childUser)
  })

  test('parent-only guards use the active user role', () => {
    const context = {
      get(key: string) {
        if (key === 'authUser') {
          return parentUser
        }

        if (key === 'activeUser') {
          return childUser
        }

        return undefined
      },
    } as any

    expect(() => requireParent(context)).toThrow('Forbidden')
  })
})
