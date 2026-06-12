import { createAuthClient } from "better-auth/solid";
import {
  usernameClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import type { Auth } from "../../auth/auth";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [usernameClient(), inferAdditionalFields<Auth>()],
});
