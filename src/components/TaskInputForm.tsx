import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const TaskInputForm: FC<{ users: User[] }> = async ({ users }) => {
	return (
		<form
			hx-post='/tasks'
			hx-target='#tasks-container'
			hx-swap='innerHTML'
			hx-on--after-request='if(event.detail.successful) this.reset()'
		>
			<input type='text' name='title' placeholder='Enter a task' required />

			<select name='priority'>
				<option value='low'>Low</option>
				<option value='medium' selected>
					Medium
				</option>
				<option value='high'>High</option>
			</select>

			<input type='number' name='value' placeholder='Points' min='1' />

			<select name='repeat'>
				<option value='none'>No Repeat</option>
				<option value='daily'>Daily</option>
				<option value='weekly'>Weekly</option>
			</select>

			<select name='assigneeId'>
				<option value=''>Unassigned</option>
				{users.map((user) => (
					<option value={user.id}>{user.name}</option>
				))}
			</select>

			<button type='submit'>Add Task</button>
		</form>
	)
}
