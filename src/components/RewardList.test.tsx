import { describe, expect, test } from 'bun:test'
import { renderToString } from 'hono/jsx/dom/server'
import type { Reward, User } from '../types'
import { RewardList } from './RewardList'

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
  points: 12,
  type: 'child',
  username: 'emma',
  passwordHash: 'hash',
} satisfies User

const rewards = [
  {
    id: 10,
    name: 'Movie Night Pick',
    value: 10,
  },
  {
    id: 11,
    name: 'Stay Up Late',
    value: 20,
  },
] satisfies Reward[]

describe('RewardList', () => {
  test('shows redeem buttons for children on affordable rewards', async () => {
    const html = await renderToString(
      <RewardList rewards={rewards} authUser={childUser} />
    )

    expect(html).toContain('Movie Night Pick')
    expect(html).toContain('hx-post="/rewards/10/redeem"')
    expect(html).toContain('>Redeem<')
  })

  test('renders an unavailable state when a child cannot afford a reward', async () => {
    const html = await renderToString(
      <RewardList rewards={rewards} authUser={childUser} />
    )

    expect(html).toContain('Stay Up Late')
    expect(html).toContain('disabled')
    expect(html).toContain('Need 8 more pts')
  })

  test('shows a reward creation form for parents', async () => {
    const html = await renderToString(
      <RewardList rewards={rewards} authUser={parentUser} />
    )

    expect(html).toContain('hx-post="/rewards"')
    expect(html).toContain('name="title"')
    expect(html).toContain('name="cost"')
    expect(html).toContain('>Add Reward<')
  })
})
