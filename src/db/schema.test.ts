import { expect, test } from 'bun:test'
import { tasks } from './schema'

test('tasks schema exposes the id column as tasks.id', () => {
  expect(tasks.id).toBeDefined()
})
