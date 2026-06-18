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
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.log(error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div class="relative w-full max-w-md animate-fade-in">
        {/* Branding */}
        <div class="text-center mb-6">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center mb-4">
            <span class="text-lg font-black tracking-widest text-white">K</span>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-primary">
            Household Board
          </span>
          <h1 class="text-2xl font-black text-primary mt-1">
            Create Account
          </h1>
        </div>
        {/* Sign Up Card */}
        <div class="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-2xl">
          <h2 class="text-lg font-bold text-slate-100 mb-1">Join the family</h2>
          <p class="text-xs text-slate-400 mb-6 font-medium">
            Create a parent account to manage your family's tasks.
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
