import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const UsersList: FC<{ users: User[] }> = ({ users }) => {
  const topBalance = users
    .filter((user) => user.type === 'child')
    .reduce((highest, user) => Math.max(highest, user.points), 0)

  return (
    <section class='card bg-base-100 shadow-sm border border-base-300'>
      <div class='card-body p-4'>

        <div class='flex items-center justify-between gap-3'>
          <div>
            <h2 class='card-title text-base'>Family Score</h2>
            <p class='text-sm text-base-content/60'>
              Track who can cash in rewards next. Top balance: {topBalance} pts
            </p>
          </div>
          <label for='score-drawer' class='btn btn-ghost btn-sm btn-circle'>
            ✕
          </label>
        </div>
        <ul class='divide-y divide-base-300'>
          {users.filter(u => u.type === 'child').map((user) => (
            <li key={user.id} class='flex items-center justify-between gap-3 py-3'>
              <div>
                <p class='font-medium'>{user.name}</p>
                <p class='text-sm capitalize text-base-content/60'>{user.type}</p>
              </div>
              <span class='badge badge-primary badge-soft'>{user.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
