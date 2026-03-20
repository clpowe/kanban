import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const UsersList: FC<{ users: User[] }> = ({ users }) => {
  return (
    <section class='card bg-base-100 shadow-sm border border-base-300'>
      <div class='card-body p-4'>
        <div class='flex items-center justify-between gap-3'>
          <div>
            <h2 class='card-title text-base'>Points</h2>
          </div>
        </div>
        <ul class='divide-y divide-base-300'>
          {users.filter(u => u.type === 'child').map((user) => (
            <li key={user.id} class='flex items-center justify-between gap-3 py-3'>
              <div>
                <p class='font-medium'>{user.name}</p>
                <p class='text-sm capitalize text-base-content/60'>{user.type}</p>
              </div>
              <span class='badge badge-outline'>{user.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
