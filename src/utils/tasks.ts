import type { Task } from '../../types'

const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2
}

export const groupTasksByStatus = (taskList: Task[]) =>
  taskList.reduce<Record<Task['status'], Task[]>>(
    (grouped, task) => {
      grouped[task.status ?? 'todo'].push(task)
      return grouped
    },
    {
      todo: [],
      doing: [],
      review: [],
      done: []
    }
  )

export const sortTasksByPriority = (taskList: Task[]) =>
  [...taskList].sort((left, right) => {
    const priorityDifference = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]

    if (priorityDifference !== 0) {
      return priorityDifference
    }

    return left.id - right.id
  })
