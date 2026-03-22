import { describe, expect, test } from 'bun:test'
import { renderToString } from 'hono/jsx/dom/server'
import { Layout } from './Layout'
import type { User } from '../types'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 0,
  type: 'parent',
  username: 'mom',
  passwordHash: 'hash',
} satisfies User

const childUser = {
  id: 2,
  name: 'Emma',
  points: 0,
  type: 'child',
  username: 'emma',
  passwordHash: 'hash',
} satisfies User

describe('Layout', () => {
  test('renders a header switcher with the active user and all family members', async () => {
    const html = await renderToString(
      <Layout activeUser={childUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('Switch User')
    expect(html).toContain('Active: Emma')
    expect(html).toContain('badge badge-outline badge-sm capitalize">child</span>')
    expect(html).toContain('<option value="1">Mom</option>')
    expect(html).toContain('<option value="2" selected="">Emma</option>')
  })

  test('links the compiled app stylesheet', async () => {
    const html = await renderToString(
      <Layout activeUser={childUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('<link rel="stylesheet" href="/app.css"/>')
  })

  test('uses an explicit light theme and visible navbar surface', async () => {
    const html = await renderToString(
      <Layout activeUser={childUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('<html data-theme="light">')
    expect(html).toContain(
      'class="navbar rounded-box border border-base-300 bg-base-100 px-4 shadow-sm md:px-6"'
    )
  })

  test('renders a right-side task drawer with a header trigger', async () => {
    const html = await renderToString(
      <Layout activeUser={parentUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('class="drawer drawer-end"')
    expect(html).toContain('id="task-drawer"')
    expect(html).toContain('>Add Task<')
    expect(html).toContain('Create a new task and drop it into the board.')
  })

  test('renders the score drawer as an independent nested daisyui drawer', async () => {
    const html = await renderToString(
      <Layout activeUser={parentUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('id="score-drawer"')
    expect(html).toContain(
      '<input id="task-drawer" type="checkbox" class="drawer-toggle"/><div class="drawer-content"><div class="drawer drawer-end"><input id="score-drawer" type="checkbox" class="drawer-toggle"/>'
    )
    expect(html).toContain('for="score-drawer" aria-label="close sidebar" class="drawer-overlay"')
    expect(html).toContain('id="users-container"')
    expect(html).toContain('id="rewards-container"')
  })

  test('renders a parent reward creation affordance', async () => {
    const html = await renderToString(
      <Layout activeUser={parentUser} users={[parentUser, childUser]}>
        <main>content</main>
      </Layout>
    )

    expect(html).toContain('>Add Reward<')
    expect(html).toContain('hx-post="/rewards"')
    expect(html).toContain('name="title"')
    expect(html).toContain('name="cost"')
  })
})
