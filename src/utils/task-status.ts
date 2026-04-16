export const activeTaskStatuses = ['todo', 'doing', 'review', 'done'] as const

export const allTaskStatuses = [...activeTaskStatuses, 'archived'] as const

export type ActiveTaskStatus = (typeof activeTaskStatuses)[number]
export type TaskStatus = (typeof allTaskStatuses)[number]

export const isTaskStatus = (value: string): value is TaskStatus =>
  allTaskStatuses.includes(value as TaskStatus)

export const isActiveTaskStatus = (value: string): value is ActiveTaskStatus =>
  activeTaskStatuses.includes(value as ActiveTaskStatus)
