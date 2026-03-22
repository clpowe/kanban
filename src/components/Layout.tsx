import type { FC } from 'hono/jsx'
import type { User } from '../types'
import { UserSwitcher } from './UserSwitcher'
import { RewardInputForm } from './RewardInputForm'
import { TaskInputForm } from './TaskInputForm'

export const Layout: FC<{ activeUser: User; users: User[] }> = (props) => {
  const canCreateTask = props.activeUser.type === 'parent'

  return (
    <html data-theme='light'>
      <head>
        <title>Family Task</title>
        <link rel='stylesheet' href='/app.css' />
        <script
          src='https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js'
          integrity='sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz'
          crossorigin='anonymous'
        ></script>
        <script src='https://unpkg.com/hyperscript.org@0.9.14'></script>
      </head>

      <body class='min-h-screen bg-base-200 text-base-content'>

        <div class='drawer drawer-end'>
          <input id='task-drawer' type='checkbox' class='drawer-toggle' />
          <div class='drawer-content'>
            <div class='drawer drawer-end'>
              <input id='score-drawer' type='checkbox' class='drawer-toggle' />
              <div class='drawer-content'>
                <div class='mx-auto flex min-h-screen max-w-8xl flex-col gap-6 px-4 py-6 lg:px-6'>
                  <UserSwitcher
                    activeUser={props.activeUser}
                    users={props.users}
                    canCreateTask={canCreateTask}
                  />
                  <div class="card bg-base-100 shadow-sm border border-base-300 p-4">
                    <h2 class="text-2xl">
                      {props.activeUser.name}
                    </h2>
                    <p>Points</p>
                    <p>
                      {props.activeUser.points}
                    </p>
                  </div>
                  {props.children}
                </div>
              </div>

              <div class='drawer-side z-30'>
                <label for='score-drawer' aria-label='close sidebar' class='drawer-overlay'></label>
                <div class='flex min-h-full w-full max-w-lg flex-col gap-4 bg-base-200 p-4 sm:p-6'>
                  <section
                    id='users-container'
                    hx-get='/users'
                    hx-trigger='load, refreshUsers from:body, every 60s'
                    hx-swap='innerHTML'
                  ></section>
                  <section
                    id='rewards-container'
                    hx-get='/rewards'
                    hx-trigger='load, refreshRewards from:body'
                    hx-swap='innerHTML'
                  ></section>
                </div>
              </div>
            </div>
          </div>

          {canCreateTask ? (
            <div class='drawer-side z-20'>
              <label for='task-drawer' aria-label='close sidebar' class='drawer-overlay'></label>
              <div class='flex min-h-full w-full max-w-lg flex-col gap-4 bg-base-200 p-4 sm:p-6'>
                <TaskInputForm users={props.users} inDrawer />
                <RewardInputForm inDrawer />
              </div>
            </div>
          ) : null}
        </div>
      </body>
    </html>
  )
}
