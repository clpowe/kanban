import { Show, createSignal } from "solid-js";
import { authClient } from "../lib/auth-client";

export default function Login() {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleSignIn = async (event: Event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await authClient.signIn.username({
        username: username(),
        password: password(),
      });

      if (signInError) {
        setError(signInError.message || "That username and password did not match.");
        return;
      }

      if (data) window.location.href = "/";
    } catch {
      setError("The sign-in request did not connect. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="auth-page">
      <section class="auth-intro" aria-labelledby="login-title">
        <a href="/" class="wordmark" aria-label="Family Task home">
          <strong>Family Task</strong>
          <small>Household board</small>
        </a>
        <h1 id="login-title">Do the thing. Get the point.</h1>
        <p>Tasks stay clear. Progress stays visible. Everyone knows what’s next.</p>
      </section>

      <section class="auth-card">
        <header>
          <h2>Welcome back</h2>
          <p>Sign in with your family account.</p>
        </header>

        <Show when={error()}>
          <p class="form-status" data-state="error" role="alert">{error()}</p>
        </Show>

        <form onSubmit={handleSignIn}>
          <label>
            Username
            <input
              type="text"
              placeholder="sam"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              required
              autocomplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Your password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              required
              autocomplete="current-password"
            />
          </label>
          <button type="submit" class="primary" disabled={loading()} aria-busy={loading() ? "true" : "false"}>
            {loading() ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <footer>
          <p>Need a family account? <a href="/register">Create one</a></p>
          <small>Parent accounts manage family access.</small>
        </footer>
      </section>
    </main>
  );
}
