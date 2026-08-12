import { describe, expect, test } from "bun:test";
import type { Env } from "../db/client";
import {
  createPostHogClient,
  queuePostHogTelemetry,
  type PostHogTelemetryClient,
} from "./posthog";

function bindings(apiKey?: string): Env["Bindings"] {
  return {
    POSTHOG_API_KEY: apiKey,
    POSTHOG_HOST: "https://posthog.invalid",
  } as Env["Bindings"];
}

describe("PostHog telemetry queue", () => {
  test("does not create a network client without a real API key", () => {
    expect(createPostHogClient(bindings())).toBeNull();
    expect(createPostHogClient(bindings("dummy-key"))).toBeNull();
  });

  test("queues capture and shutdown while swallowing delivery failures", async () => {
    const calls: string[] = [];
    const queued: Promise<unknown>[] = [];
    const executionCtx = {
      waitUntil(promise: Promise<unknown>) {
        queued.push(promise);
      },
    } as ExecutionContext;
    const client: PostHogTelemetryClient = {
      async captureImmediate() {
        calls.push("capture");
        throw new Error("PostHog unavailable");
      },
      identify() {
        calls.push("identify");
      },
      async shutdown() {
        calls.push("shutdown");
      },
    };

    const result = queuePostHogTelemetry(
      bindings("phc-test"),
      executionCtx,
      {
        type: "capture",
        distinctId: "2",
        event: "reward redeemed",
        properties: { reward_id: 9 },
      },
      () => client,
    );

    expect(result).toBeUndefined();
    expect(queued).toHaveLength(1);
    await expect(Promise.all(queued)).resolves.toBeArray();
    expect(calls).toEqual(["capture", "shutdown"]);
  });

  test("queues identify without blocking the request", async () => {
    const calls: string[] = [];
    const queued: Promise<unknown>[] = [];
    const client: PostHogTelemetryClient = {
      async captureImmediate() {
        calls.push("capture");
      },
      identify() {
        calls.push("identify");
      },
      async shutdown() {
        calls.push("shutdown");
      },
    };

    const result = queuePostHogTelemetry(
      bindings("phc-test"),
      {
        waitUntil(promise: Promise<unknown>) {
          queued.push(promise);
        },
      } as ExecutionContext,
      {
        type: "identify",
        distinctId: "1",
        properties: { name: "Mom" },
      },
      () => client,
    );

    expect(result).toBeUndefined();
    expect(queued).toHaveLength(1);
    await Promise.all(queued);
    expect(calls).toEqual(["identify", "shutdown"]);
  });
});
