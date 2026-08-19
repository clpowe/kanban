import { createAuthClient } from "better-auth/client";
import {
  usernameClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import type { Auth } from "../../auth/auth";
import { useStore } from "./nanostore";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [usernameClient(), inferAdditionalFields<Auth>()],
});

/** Solid 2 accessor over better-auth's session atom. */
export const useSession = () => useStore(authClient.useSession);
