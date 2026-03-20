import type { FC } from 'hono/jsx'
import type { Task, User } from '../types'
import { groupTasksByStatus, sortTasksByPriority } from '../utils/tasks'
import { TaskItem } from './TaskItem'

export const TaskList: FC<{ tasks: Task[]; users: User[]; authUser: User }> = ({
	tasks,
	users,
	authUser
}) => {
	const grouped = groupTasksByStatus(tasks)
  const laneStyles = {
    todo: 'badge badge-info badge-soft',
    doing: 'badge badge-warning badge-soft',
    review: 'badge badge-secondary badge-soft',
    done: 'badge badge-success badge-soft',
  } as const

	return (
		<div class='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
			{(['todo', 'doing', 'review', 'done'] as const).map((status) => (
				<section
          key={status}
          class='card bg-base-100 shadow-sm border border-base-300'
        >
          <div class='card-body gap-4 p-4'>
            <div class='flex items-center justify-between gap-2'>
              <h3 class='text-sm font-semibold uppercase tracking-wide text-base-content/70'>
                {status}
              </h3>
              <span class={`${laneStyles[status]} badge-outline`}>
                {grouped[status]!.length}
              </span>
            </div>
					<ul class='space-y-3'>
						{sortTasksByPriority(grouped[status]!).map((task) => (
							<TaskItem task={task} users={users} authUser={authUser} />
						))}
            {grouped[status]!.length === 0 ? (
              <li class='rounded-box border border-dashed border-base-300 bg-base-200/60 px-4 py-6 text-center text-sm text-base-content/60'>
                Nothing here yet
              </li>
            ) : null}
					</ul>
          </div>
				</section>
			))}
		</div>
	)
}
