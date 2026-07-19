import { A } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { authClient } from "../lib/auth-client";

export default function Register() {
  const [name, setName] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleRegister = async (event: Event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await authClient.signUp.email({
        email: email(),
        password: password(),
        name: name(),
        username: username(),
        type: "parent",
      });

      if (signUpError) {
        setError(signUpError.message || "The parent account was not created.");
        return;
      }

      if (data) window.location.href = "/";
    } catch {
      setError("The account request did not connect. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="auth-page">
      <section class="auth-intro" aria-labelledby="register-title">
        <A href="/" class="wordmark" aria-label="Family Task home">
          <strong>Family Task</strong>
          <small>Household board</small>
        </A>
        <h1 id="register-title">One board. Fewer reminders.</h1>
        <p>Parents set the task. Kids move it forward. The board keeps score.</p>
      </section>

      <section class="auth-card">
        <header>
          <h2>Start your board</h2>
          <p>Create the parent account first. Add children from Settings.</p>
        </header>

        <Show when={error()}>
          <p class="form-status" data-state="error" role="alert">{error()}</p>
        </Show>

        <form onSubmit={handleRegister}>
          <label>
            Full name
            <input
              type="text"
              placeholder="Emma Powe"
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
              required
              autocomplete="name"
            />
          </label>
          <label>
            Username
            <input
              type="text"
              placeholder="emma"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              required
              autocomplete="username"
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              placeholder="emma@example.com"
              value={email()}
              onInput={(event) => setEmail(event.currentTarget.value)}
              required
              autocomplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              required
              minlength="6"
              autocomplete="new-password"
            />
          </label>
          <button type="submit" class="primary" disabled={loading()} aria-busy={loading()}>
            {loading() ? "Creating account…" : "Create account"}
          </button>
        </form>

        <footer>
          <p>Already have an account? <A href="/login">Sign in</A></p>
        </footer>
      </section>
    </main>
  );
}
