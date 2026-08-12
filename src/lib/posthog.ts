import { PostHog } from "posthog-node";
import type { Env } from "../db/client";

export type PostHogTelemetryClient = Pick<
  PostHog,
  "captureImmediate" | "identify" | "shutdown"
>;

type CaptureTelemetry = Parameters<PostHog["captureImmediate"]>[0] & {
  type: "capture";
};
type IdentifyTelemetry = Parameters<PostHog["identify"]>[0] & {
  type: "identify";
};

export type PostHogTelemetry = CaptureTelemetry | IdentifyTelemetry;

type ClientFactory = (
  env: Env["Bindings"],
) => PostHogTelemetryClient | null;

function configuredApiKey(env: Env["Bindings"]) {
  const apiKey = env?.POSTHOG_API_KEY?.trim();
  return apiKey && apiKey !== "dummy-key" ? apiKey : null;
}

export function createPostHogClient(
  env: Env["Bindings"],
): PostHog | null {
  const apiKey = configuredApiKey(env);
  if (!apiKey) return null;

  return new PostHog(apiKey, {
    host: env?.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
}

export function getRequestExecutionContext(context: {
  readonly executionCtx: ExecutionContext;
}): ExecutionContext | undefined {
  try {
    return context.executionCtx;
  } catch {
    return undefined;
  }
}

export function queuePostHogTelemetry(
  env: Env["Bindings"],
  executionCtx: ExecutionContext | undefined,
  telemetry: PostHogTelemetry,
  createClient: ClientFactory = createPostHogClient,
): void {
  let client: PostHogTelemetryClient | null;

  try {
    client = createClient(env);
  } catch (error) {
    console.error("[TELEMETRY] Failed to create PostHog client", error);
    return;
  }

  if (!client) return;

  const delivery = (async () => {
    try {
      if (telemetry.type === "capture") {
        const { type: _type, ...capture } = telemetry;
        await client.captureImmediate(capture);
      } else {
        const { type: _type, ...identify } = telemetry;
        client.identify(identify);
      }
    } catch (error) {
      console.error("[TELEMETRY] PostHog delivery failed", error);
    } finally {
      try {
        await client.shutdown();
      } catch (error) {
        console.error("[TELEMETRY] PostHog shutdown failed", error);
      }
    }
  })();

  if (executionCtx) {
    try {
      executionCtx.waitUntil(delivery);
      return;
    } catch (error) {
      console.error("[TELEMETRY] Failed to queue PostHog delivery", error);
    }
  }

  void delivery;
}
