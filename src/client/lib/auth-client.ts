import { createAuthClient } from "better-auth/solid";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [usernameClient()],
});
