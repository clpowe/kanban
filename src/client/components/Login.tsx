import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
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
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      {/* Ambient background glow */}
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div class="absolute bottom-1/3 right-1/4 h-80 w-80 rounded-full bg-purple-500/5 blur-3xl" />
      </div>
      <div class="relative w-full max-w-sm">
        {/* Branding */}
        <div class="text-center mb-8">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-linear-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center mb-4">
            <span class="text-lg font-black tracking-widest text-white">K</span>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
            Household Board
          </span>
          <h1 class="text-2xl font-black bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-1">
            Family Task
          </h1>
        </div>
        {/* Sign In Card */}
        <div class="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-2xl">
          <h2 class="text-lg font-bold text-white mb-1">Welcome back</h2>
          <p class="text-xs text-slate-400 mb-6">
            Sign in with your family account.
          </p>
          <Show when={error()}>
            <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 mb-4">
              <p class="text-xs font-semibold text-rose-400">{error()}</p>
            </div>
          </Show>
          <form onSubmit={handleSignIn} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label
                for="login-username"
                class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                required
                autocomplete="username"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label
                for="login-password"
                class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                autocomplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading()}
              class="btn btn-sm rounded-xl font-bold border-0 bg-indigo-600 hover:bg-indigo-500 text-white mt-2 disabled:opacity-50"
            >
              {loading() ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
        <p class="text-center text-[10px] text-slate-600 mt-6">
          Family accounts are managed by parents.
        </p>
      </div>
    </div>
  );
}
