import type { FC } from 'hono/jsx'
import type { Task, User } from '../types'
import { canManageTask, canUpdateTaskStatus } from '../auth/authorization'

export const TaskItem: FC<{ task: Task; users?: User[]; authUser: User }> = ({
	task,
	users = [],
	authUser
}) => {
	const assignee = users.find((user) => user.id === task.assigneeId)
	const canManage = canManageTask(authUser)
	const canUpdateStatus = canUpdateTaskStatus(authUser, task.assigneeId)

	return (
		<li key={task.id} data-id={task.id}>
			{canManage ? (
				<form
					hx-patch={`/task/${task.id}`}
					hx-trigger='change'
					hx-target='closest li'
					hx-swap='outerHTML'
					hx-sync='this:replace'
				>
					<input type='text' name='title' value={task.title} />
					<select name='priority'>
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

					<select name='assigneeId'>
						<option value=''>Unassigned</option>
						{users.map((user) => (
							<option value={user.id} selected={task.assigneeId === user.id}>
								{user.name}
							</option>
						))}
					</select>
				</form>
			) : (
				<div>
					<p>{task.title}</p>
					<p>{task.priority}</p>
					<p>{assignee?.name ?? 'Unassigned'}</p>
				</div>
			)}

			{canUpdateStatus ? (
				<select
					name='status'
					id={`task-${task.id}`}
					hx-patch={`/task/${task.id}/status`}
					hx-trigger='change consume'
					hx-swap='innerHTML'
					hx-target='#tasks-container'
				>
					<option value='todo' selected={task.status === 'todo'}>
						todo
					</option>
					<option value='doing' selected={task.status === 'doing'}>
						doing
					</option>
					<option value='review' selected={task.status === 'review'}>
						review
					</option>
					<option value='done' selected={task.status === 'done'}>
						done
					</option>
				</select>
			) : (
				<p>Status: {task.status}</p>
			)}
			{canManage ? (
				<button
					hx-delete={`/task/${task.id}`}
					hx-target='closest li'
					hx-swap='delete'
					hx-trigger='click'
				>
					Delete
				</button>
			) : null}
		</li>
	)
}
