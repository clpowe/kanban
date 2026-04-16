import type { FC } from 'hono/jsx'
import type { Task, User } from '../types'
import { sortTasksByPriority } from '../utils/tasks'
import { TaskItem } from './TaskItem'

export const ArchivedTaskList: FC<{
  tasks: Task[]
  users: User[]
  authUser: User
  selectedAssigneeId?: number | null
}> = ({ tasks, users, authUser, selectedAssigneeId = null }) => {
  return (
    <section
      id='archived-tasks-container'
      class='card border border-base-300 bg-base-100 shadow-sm'
    >
      <div class='card-body gap-4 p-4'>
        <div class='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
          <div>
            <h2 class='card-title'>Archived Tasks</h2>
            <p class='text-sm text-base-content/70'>
              Weekly completed tasks live here until a parent restores them.
            </p>
          </div>
          <form
            hx-get='/archived/tasks'
            hx-target='#archived-tasks-container'
            hx-swap='innerHTML'
            hx-trigger='change'
            class='flex w-full max-w-sm flex-col gap-2'
          >
            <label for='archived-assignee-filter' class='label px-1 pb-0'>
              <span class='label-text text-xs uppercase tracking-wide text-base-content/60'>
                Filter by family member
              </span>
            </label>
            <select
              id='archived-assignee-filter'
              name='assigneeId'
              class='select select-bordered w-full bg-base-100'
            >
              <option value='all' selected={selectedAssigneeId === null}>
                All family members
              </option>
              {users.map((user) => (
                <option
                  value={user.id}
                  selected={selectedAssigneeId === user.id}
                >
                  {user.name}
                </option>
              ))}
            </select>
          </form>
        </div>

        {tasks.length === 0 ? (
          <div class='rounded-box border border-dashed border-base-300 bg-base-200/60 px-4 py-8 text-center text-sm text-base-content/60'>
            No archived tasks match this filter.
          </div>
        ) : (
          <ul class='space-y-3'>
            {sortTasksByPriority(tasks).map((task) => (
              <TaskItem
                task={task}
                users={users}
                authUser={authUser}
                context='archive'
                archiveFilterAssigneeId={selectedAssigneeId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
