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

	return (
		<>
			{(['todo', 'doing', 'review', 'done'] as const).map((status) => (
				<div key={status}>
					<h3>{status}</h3>
					<ul>
						{sortTasksByPriority(grouped[status]!).map((task) => (
							<TaskItem task={task} users={users} authUser={authUser} />
						))}
					</ul>
				</div>
			))}
		</>
	)
}
