import type { User } from '../types'

export function canManageTask(user: User): boolean {
  return user.type === 'parent'
}

export function canUpdateTaskStatus(
  user: User,
  assigneeId: number | null
): boolean {
  if (user.type === 'parent') {
    return true
  }

  return assigneeId === user.id
}
