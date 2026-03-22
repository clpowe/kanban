import type { FC } from 'hono/jsx'
import type { Task, User } from '../types'
import { canManageTask, canUpdateTaskStatus } from '../auth/authorization'

const priorityBadgeClass: Record<Task['priority'], string> = {
  low: 'badge badge-success badge-soft',
  medium: 'badge badge-warning badge-soft',
  high: 'badge badge-error badge-soft',
}

const statusOptions = ['todo', 'doing', 'review', 'done'] as const

export const TaskItem: FC<{ task: Task; users?: User[]; authUser: User }> = ({
  task,
  users = [],
  authUser
}) => {
  const assignee = users.find((user) => user.id === task.assigneeId)
  const canManage = canManageTask(authUser)
  const canUpdateStatus = canUpdateTaskStatus(authUser, task.assigneeId)

  return (
    <li
      key={task.id}
      data-id={task.id}
      class='card bg-base-100 border border-base-300 shadow-sm'
    >
      <div class='card-body gap-3 p-2'>
        {canManage ? (
          <form
            class='grid gap-3'
            hx-patch={`/task/${task.id}`}
            hx-trigger='change'
            hx-target='closest li'
            hx-swap='outerHTML'
            hx-sync='this:replace'
          >
            <h4>
              <input class='input input-bordered w-full input-ghost input-sm' type='text' name='title' value={task.title} />
            </h4>
            <select class='select select-bordered w-full select-xs' name='priority'>
              <option value='low' selected={task.priority === 'low'}>
                Low
              </option>
              <option value='medium' selected={task.priority === 'medium'}>
                Medium
              </option>
              <option value='high' selected={task.priority === 'high'}>
                High
              </option>
            </select>

            <select class='select select-bordered w-full select-xs' name='assigneeId'>
              <option value=''>Unassigned</option>
              {users.map((user) => (
                <option value={user.id} selected={task.assigneeId === user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <div class='space-y-1 text-sm text-base-content/70'>
            <h4 class="font-bold text-lg">
              {task.title}
            </h4>
            <p>Assigned to {assignee?.name ?? 'Unassigned'}</p>
            <p>Repeats: {task.repeat ?? 'none'}</p>
          </div>
        )}

        <div class='flex flex-wrap items-center gap-3'>
          <div class='flex flex-wrap items-start justify-between gap-2'>
            <div class='flex flex-wrap gap-2'>
              <span class={priorityBadgeClass[task.priority]}>{task.priority}</span>
              <span class='badge badge-outline'>
                {task.value ? `${task.value} pts` : 'No points'}
              </span>
            </div>
          </div>
          {canUpdateStatus ? (
            <select
              class='select select-bordered w-full max-w-xs select-xs'
              name='status'
              id={`task-${task.id}`}
              hx-patch={`/task/${task.id}/status`}
              hx-trigger='change consume'
              hx-swap='innerHTML'
              hx-target='#tasks-container'
            >
              {statusOptions.map((status) => (
                <option value={status} selected={task.status === status}>
                  {status}
                </option>
              ))}
            </select>
          ) : (
            <span class='badge badge-outline capitalize'>Status: {task.status}</span>
          )}
          {canManage ? (
            <button
              class='btn btn-ghost btn-sm text-error'
              hx-delete={`/task/${task.id}`}
              hx-target='closest li'
              hx-swap='delete'
              hx-trigger='click'
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
