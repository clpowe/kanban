import { drizzle } from 'drizzle-orm/d1'
import { users, tasks, rewards } from './src/db/schema'
import { hashPassword } from './src/auth/password'

interface Env {
  family_kanban: D1Database
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.family_kanban)

    try {
      const defaultPasswordHash = await hashPassword('family123')

      // Clear existing data
      await db.delete(tasks)
      await db.delete(users)
      await db.delete(rewards)

      // Insert users
      const insertedUsers = await db
        .insert(users)
        .values([
          {
            name: 'Mom',
            points: 0,
            type: 'parent',
            username: 'mom',
            passwordHash: defaultPasswordHash
          },
          {
            name: 'Dad',
            points: 0,
            type: 'parent',
            username: 'dad',
            passwordHash: defaultPasswordHash
          },
          {
            name: 'Emma',
            points: 0,
            type: 'child',
            username: 'emma',
            passwordHash: defaultPasswordHash
          },
          {
            name: 'Noah',
            points: 0,
            type: 'child',
            username: 'noah',
            passwordHash: defaultPasswordHash
          }
        ])
        .returning()

      const emma = insertedUsers.find((u) => u.name === 'Emma')
      const noah = insertedUsers.find((u) => u.name === 'Noah')

      if (!emma || !noah) {
        throw new Error('Expected seeded child users to exist')
      }

      // Insert rewards
      await db.insert(rewards).values([
        { name: 'Ice Cream', value: 10 },
        { name: 'Movie Night Pick', value: 20 },
        { name: 'Stay Up Late', value: 30 }
      ])

      // Insert tasks
      await db.insert(tasks).values([
        {
          title: 'Clean Room',
          priority: 'medium',
          value: 5,
          status: 'todo',
          repeat: 'daily',
          assigneeId: emma.id
        },
        {
          title: 'Take Out Trash',
          priority: 'low',
          value: 3,
          status: 'todo',
          repeat: 'weekly',
          assigneeId: noah.id
        },
        {
          title: 'Do Homework',
          priority: 'high',
          value: 7,
          status: 'todo',
          repeat: 'daily',
          assigneeId: noah.id
        }
      ])

      return new Response('✅ Family Kanban database seeded successfully!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    } catch (error) {
      return new Response(`❌ Error seeding database: ${error}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }
}
