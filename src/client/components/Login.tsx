import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { authClient } from "../lib/auth-client";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleSignIn = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await authClient.signIn.username({
        username: username(),
        password: password(),
      });
      if (signInError) {
        setError(signInError.message || "Invalid username or password");
        return;
      }
      if (data) {
        window.location.href = "/";
      }
    } catch (err) {
      setError("We couldn’t sign you in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="auth-page">
      <div class="auth-shell">
        <section class="auth-intro" aria-labelledby="login-brand-title">
          <div class="app-brand">
            <span class="brand-character" aria-hidden="true">
              FT
            </span>
            <span class="app-brand__copy">
              <span class="app-brand__name">Family Task</span>
              <span class="app-brand__meta">Household board</span>
            </span>
          </div>
          <div class="grid gap-4">
            <h1 id="login-brand-title">Do the thing. Get the point.</h1>
            <p>Tasks stay clear. Progress stays visible. Everyone knows what’s next.</p>
          </div>
        </section>

        <div class="auth-card-wrap">
          <div class="auth-card">
            <h2 class="text-2xl font-bold text-slate-100 mb-2">Welcome back</h2>
            <p class="text-sm text-slate-400 mb-6">
              Sign in with your family account.
            </p>
            <Show when={error()}>
              <div class="auth-error px-4 py-3 mb-4" role="alert" aria-live="polite">
                <p class="text-sm font-semibold">{error()}</p>
              </div>
            </Show>
            <form onSubmit={handleSignIn} class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label
                  for="login-username"
                  class="text-xs font-bold text-slate-500 px-1"
                >
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  placeholder="sam"
                  class="input w-full"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  required
                  autocomplete="username"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label
                  for="login-password"
                  class="text-xs font-bold text-slate-500 px-1"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Your password"
                  class="input w-full"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                  autocomplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading()}
                class="btn w-full mt-2"
              >
                {loading() ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div class="auth-card__footer grid gap-2">
              <span>
                Need a family account?{" "}
                <A
                  href="/register"
                  class="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                >
                  Create one
                </A>
              </span>
              <p class="text-xs text-slate-600">
                Parent accounts manage family access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
