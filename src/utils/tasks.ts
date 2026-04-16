import type { Task } from '../types'
import { activeTaskStatuses } from './task-status'

const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2
}

export const groupTasksByStatus = (taskList: Task[]) =>
  taskList.reduce<Record<(typeof activeTaskStatuses)[number], Task[]>>(
    (grouped, task) => {
      const bucket = grouped[task.status ?? 'todo'] ?? grouped.todo
      bucket.push(task)
      return grouped
    },
    Object.fromEntries(
      activeTaskStatuses.map((status) => [status, [] as Task[]])
    ) as Record<(typeof activeTaskStatuses)[number], Task[]>
  )

export const sortTasksByPriority = (taskList: Task[]) =>
  [...taskList].sort((left, right) => {
    const leftRank = PRIORITY_RANK[left.priority] ?? Number.MAX_SAFE_INTEGER
    const rightRank = PRIORITY_RANK[right.priority] ?? Number.MAX_SAFE_INTEGER
    const priorityDifference = leftRank - rightRank

    if (priorityDifference !== 0) {
      return priorityDifference
    }

    return left.id - right.id
  })
