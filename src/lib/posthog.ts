import { PostHog } from 'posthog-node'
import type { Env } from '../db/client'

export function createPostHogClient(env: Env['Bindings']): PostHog {
  return new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })
}
