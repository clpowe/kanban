import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { authClient } from "../lib/auth-client";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");

  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function handleRegister(event: Event) {
    event?.preventDefault();
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
        setError(signUpError.message || "Failed to create account");
        return;
      }

      if (data) {
        window.location.href = "/";
      }
    } catch (error) {
      console.log(error);
      setError("We couldn’t create the account. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="auth-page">
      <div class="auth-shell">
        <section class="auth-intro" aria-labelledby="register-brand-title">
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
            <h1 id="register-brand-title">One board. Fewer reminders.</h1>
            <p>Parents set the task. Kids move it forward. The board keeps score.</p>
          </div>
        </section>

        <div class="auth-card-wrap">
          <div class="auth-card">
            <h2 class="text-2xl font-bold text-slate-100 mb-2">Start your board</h2>
            <p class="text-sm text-slate-400 mb-6 font-medium">
              Create the parent account first. You can add children next.
            </p>
            <Show when={error()}>
              <div class="auth-error px-4 py-3 mb-4" role="alert" aria-live="polite">
                <p class="text-sm font-semibold">{error()}</p>
              </div>
            </Show>
            <form onSubmit={handleRegister} class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="register-name" class="text-xs font-bold text-slate-500 px-1">
                  Full name
                </label>
                <input
                  id="register-name"
                  type="text"
                  placeholder="Emma Powe"
                  class="input w-full"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  required
                  autocomplete="name"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="register-username" class="text-xs font-bold text-slate-500 px-1">
                  Username
                </label>
                <input
                  id="register-username"
                  type="text"
                  placeholder="emma"
                  class="input w-full"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  required
                  autocomplete="username"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="register-email" class="text-xs font-bold text-slate-500 px-1">
                  Email address
                </label>
                <input
                  id="register-email"
                  type="email"
                  placeholder="emma@example.com"
                  class="input w-full"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  required
                  autocomplete="email"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="register-password" class="text-xs font-bold text-slate-500 px-1">
                  Password
                </label>
                <input
                  id="register-password"
                  type="password"
                  placeholder="At least 6 characters"
                  class="input w-full"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                  minlength="6"
                  autocomplete="new-password"
                />
              </div>
              <button type="submit" disabled={loading()} class="btn w-full mt-2">
                {loading() ? "Creating account…" : "Create account"}
              </button>
            </form>
            <div class="auth-card__footer">
              <span>
                Already have an account?{" "}
                <A href="/login" class="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                  Sign in
                </A>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
