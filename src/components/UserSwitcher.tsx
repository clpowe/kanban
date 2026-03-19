import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const UserSwitcher: FC<{ activeUser: User; users: User[] }> = ({
  activeUser,
  users,
}) => {
  return (
    <header>
      <div>
        <h1>Family Task</h1>
        <p>Active: {activeUser.name}</p>
        <p>Role: {activeUser.type}</p>
      </div>
      <form hx-patch='/session/active-user' hx-trigger='change' hx-swap='none'>
        <label for='active-user-id'>Switch User</label>
        <select id='active-user-id' name='userId'>
          {users.map((user) => (
            <option value={user.id} selected={user.id === activeUser.id}>
              {user.name}
            </option>
          ))}
        </select>
      </form>
    </header>
  )
}
