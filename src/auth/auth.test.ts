import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
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

const testDate = new Date('2026-07-24T00:00:00Z')

const parentUser = {
  id: 1,
  name: 'Mom',
  email: 'mom@example.com',
  emailVerified: true,
  image: null,
  createdAt: testDate,
  updatedAt: testDate,
  points: 0,
  type: 'parent',
  username: 'mom',
  displayUsername: null,
} satisfies User

const childUser = {
  id: 2,
  name: 'Emma',
  email: 'emma@example.com',
  emailVerified: true,
  image: null,
  createdAt: testDate,
  updatedAt: testDate,
  points: 0,
  type: 'child',
  username: 'emma',
  displayUsername: null,
} satisfies User

describe('password auth helpers', () => {
  test('hashes and verifies a password', async () => {
    const hash = await hashPassword('family-secret')

    expect(hash).not.toBe('family-secret')
    expect(await verifyPassword({ password: 'family-secret', hash })).toBe(true)
  })

  test('rejects an invalid password', async () => {
    const hash = await hashPassword('family-secret')

    expect(await verifyPassword({ password: 'not-it', hash })).toBe(false)
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
      loginUserId: parentUser.id,
      activeUserId: childUser.id,
      familyUserIds: users.map((user) => user.id),
    })

    expect(parseFamilySession(serialized)).toEqual({
      loginUserId: parentUser.id,
      activeUserId: childUser.id,
      familyUserIds: [parentUser.id, childUser.id],
    })
  })

  test('resolves the active user from session state when present', () => {
    const activeUser = resolveActiveUser(
      users,
      parentUser,
      serializeFamilySession({
        loginUserId: parentUser.id,
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
          loginUserId: parentUser.id,
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
