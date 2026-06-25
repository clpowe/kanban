import { PostHog } from 'posthog-node'
import type { Env } from '../db/client'

export function createPostHogClient(env: Env['Bindings']): PostHog {
  return new PostHog(env?.POSTHOG_API_KEY || 'dummy-key', {
    host: env?.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })
}
