import type { FC } from 'hono/jsx'
import type { User } from '../types'
import { UserSwitcher } from './UserSwitcher'

export const Layout: FC<{ activeUser: User; users: User[] }> = (props) => {
	return (
		<html>
			<head>
				<title>Family Task</title>
				<script
					src='https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js'
					integrity='sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz'
					crossorigin='anonymous'
				></script>
				<script src='https://unpkg.com/hyperscript.org@0.9.14'></script>
			</head>
			<body>
				<UserSwitcher activeUser={props.activeUser} users={props.users} />
				{props.children}
			</body>
		</html>
	)
}
