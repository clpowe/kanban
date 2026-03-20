import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const UserSwitcher: FC<{
  activeUser: User
  users: User[]
  canCreateTask?: boolean
}> = ({
  activeUser,
  users,
  canCreateTask,
}) => {
  return (
    <header class='navbar rounded-box border border-base-300 bg-base-100 px-4 shadow-sm md:px-6'>
      <div class='flex-1'>
        <div>
          <p class='text-xs font-semibold uppercase tracking-[0.2em] text-base-content/60'>
            Family board
          </p>
          <h1 class='text-2xl font-semibold'>Family Task</h1>
          <div class='mt-2 flex flex-wrap items-center gap-2 text-sm text-base-content/70'>
            <span>Active: {activeUser.name}</span>
            <span class='badge badge-outline badge-sm capitalize'>{activeUser.type}</span>
          </div>
        </div>
      </div>
      <div class='flex w-full max-w-md flex-col gap-3 md:items-end'>
        {canCreateTask ? (
          <label for='task-drawer' class='btn btn-primary btn-sm self-start md:self-end'>
            Add Task
          </label>
        ) : null}
        <form
          hx-patch='/session/active-user'
          hx-trigger='change'
          hx-swap='none'
          class='flex w-full flex-col gap-2'
        >
          <label for='active-user-id' class='label px-1 pb-0'>
            <span class='label-text text-xs uppercase tracking-wide text-base-content/60'>
              Switch User
            </span>
          </label>
          <select id='active-user-id' name='userId' class='select select-bordered w-full bg-base-100'>
            {users.map((user) => (
              <option value={user.id} selected={user.id === activeUser.id}>
                {user.name}
              </option>
            ))}
          </select>
        </form>
      </div>
    </header>
  )
}
