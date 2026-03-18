import type { FC } from 'hono/jsx'
import type { User } from '../types'

export const UsersList: FC<{ users: User[] }> = ({ users }) => {
	return (
		<ul>
			{users.map((user) => (
				<li key={user.id}>
					<p>{user.name}</p>
					<p>{user.points}</p>
				</li>
			))}
		</ul>
	)
}
