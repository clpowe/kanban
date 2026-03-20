import { expect, test } from 'bun:test'
import { rewards, tasks } from './schema'

test('tasks schema exposes the id column as tasks.id', () => {
  expect(tasks.id).toBeDefined()
})

test('rewards schema exposes catalog label and cost columns for the service layer to use', () => {
  expect(rewards.name).toBeDefined()
  expect(rewards.value).toBeDefined()
})
