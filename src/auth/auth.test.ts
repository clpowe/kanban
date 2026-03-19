import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from './password'
import { canManageTask, canUpdateTaskStatus } from './authorization'
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
