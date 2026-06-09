import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { authClient } from "../lib/auth-client";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [type, setType] = createSignal<"parent" | "child">("child");
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
        type: type(),
      });

      if (signUpError) {
        setError(signUpError.message || "Failed to create account");
        return;
      }

      if (data) {
        navigate("/", { replace: true });
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      {/* Ambient background glow */}
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div class="absolute bottom-1/3 right-1/4 h-80 w-80 rounded-full bg-purple-500/5 blur-3xl" />
      </div>
      <div class="relative w-full max-w-md animate-fade-in">
        {/* Branding */}
        <div class="text-center mb-6">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-linear-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center mb-4">
            <span class="text-lg font-black tracking-widest text-white">K</span>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
            Household Board
          </span>
          <h1 class="text-2xl font-black bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-1">
            Create Account
          </h1>
        </div>
        {/* Sign Up Card */}
        <div class="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-2xl">
          <h2 class="text-lg font-bold text-white mb-1">Join the family</h2>
          <p class="text-xs text-slate-400 mb-6 font-medium">
            Register your account to start managing tasks.
          </p>
          <Show when={error()}>
            <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 mb-4">
              <p class="text-xs font-semibold text-rose-400">{error()}</p>
            </div>
          </Show>
          <form onSubmit={handleRegister} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label
                for="register-name"
                class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
              >
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                placeholder="e.g. Emma Powe"
                class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                required
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label
                  for="register-username"
                  class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
                >
                  Username
                </label>
                <input
                  id="register-username"
                  type="text"
                  placeholder="e.g. emma"
                  class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  required
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label
                  for="register-role"
                  class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
                >
                  Role
                </label>
                <select
                  id="register-role"
                  class="select select-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                  value={type()}
                  onChange={(e) =>
                    setType(e.currentTarget.value as "parent" | "child")
                  }
                >
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label
                for="register-email"
                class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
              >
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                placeholder="e.g. emma@family.local"
                class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label
                for="register-password"
                class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                placeholder="Min 6 characters"
                class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minlength="6"
              />
            </div>
            <button
              type="submit"
              disabled={loading()}
              class="btn btn-sm rounded-xl font-bold border-0 bg-indigo-600 hover:bg-indigo-500 text-white mt-2 disabled:opacity-50"
            >
              {loading() ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <div class="mt-6 pt-4 border-t border-slate-800/60 text-center">
            <span class="text-xs text-slate-400">
              Already have an account?{" "}
              <A
                href="/login"
                class="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                Sign In
              </A>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
