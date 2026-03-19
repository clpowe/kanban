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
    expect(html).toContain('Role: child')
    expect(html).toContain('<option value="1">Mom</option>')
    expect(html).toContain('<option value="2" selected="">Emma</option>')
  })
})
