import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const TaskInputForm: FC<{ users: User[]; inDrawer?: boolean }> = ({
  users,
  inDrawer = false,
}) => {
	return (
		<section class='card bg-base-100 shadow-sm'>
			<div class='card-body gap-4'>
				<div class='flex items-start justify-between gap-3'>
          <div>
					<h2 class='card-title'>Add a task</h2>
					<p class='text-sm text-base-content/70'>
						Create a new task and drop it into the board.
					</p>
				</div>
          {inDrawer ? (
            <label for='task-drawer' class='btn btn-ghost btn-sm btn-circle'>
              ✕
            </label>
          ) : null}
        </div>
				<form
					hx-post='/tasks'
					hx-target='#tasks-container'
					hx-swap='innerHTML'
					hx-on--after-request='if(event.detail.successful) { this.reset(); document.getElementById("task-drawer")?.click(); }'
					class='grid gap-3 md:grid-cols-2 xl:grid-cols-5'
				>
					<input
						class='input input-bordered w-full md:col-span-2 xl:col-span-2'
						type='text'
						name='title'
						placeholder='Enter a task'
						required
					/>

					<select class='select select-bordered w-full' name='priority'>
						<option value='low'>Low</option>
						<option value='medium' selected>
							Medium
						</option>
						<option value='high'>High</option>
					</select>

					<select class='select select-bordered w-full' name='repeat'>
						<option value='none'>No Repeat</option>
						<option value='daily'>Daily</option>
						<option value='weekly'>Weekly</option>
					</select>

					<select class='select select-bordered w-full md:col-span-2 xl:col-span-1' name='assigneeId'>
						<option value=''>Unassigned</option>
						{users.map((user) => (
							<option value={user.id}>{user.name}</option>
						))}
					</select>

					<div class='md:col-span-2 xl:col-span-5 flex justify-end'>
						<button class='btn btn-primary' type='submit'>
							Add Task
						</button>
					</div>
				</form>
			</div>
		</section>
	)
}
