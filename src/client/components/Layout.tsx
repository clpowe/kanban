import { Show, For, createSignal } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { authClient } from "../lib/auth-client";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = authClient.useSession();

  const isBoard = () => location.pathname === "/";
  const isArchive = () => location.pathname === "/archived";
  const isSettings = () => location.pathname === "/settings";
  const isRewards = () => location.pathname === "/rewards";
  const isAnalytics = () => location.pathname === "/analytics";
  const isParent = () => store.activeUser?.type === "parent";
  const isProfile = () => location.pathname === "/profile";

  const switchableUsers = () => {
    const isParentSession = session().data?.user?.type === "parent";
    if (!isParentSession) {
      return store.users.filter((u) => u.type !== "parent");
    }
    return store.users;
  };

  const [theme, setTheme] = createSignal(
    document.documentElement.getAttribute("data-theme") || "corporate",
  );

  const toggleTheme = () => {
    const nextTheme = theme() === "corporate" ? "business" : "corporate";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  const handleUserSwitch = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const userId = Number(target.value);
    if (!Number.isNaN(userId)) {
      storeActions.switchActiveUser(userId);
    }
  };

  return (
    <header class="navbar rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md px-4 py-3 shadow-xl md:px-6 flex-col md:flex-row gap-4 items-stretch justify-between">
      {/* Branding & Info */}
      <div class="flex flex-col items-start gap-1">
        <span class="text-xs font-bold uppercase tracking-widest text-primary">
          Household Board
        </span>
        <h1 class="text-2xl font-black text-primary">Family Task</h1>
        <Show when={store.activeUser}>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs text-slate-400">
              Active:{" "}
              <strong class="text-slate-200 inline-flex items-center gap-1.5">
                <Show when={store.activeUser!.image}>
                  <span class="text-sm select-none">
                    {store.activeUser!.image}
                  </span>
                </Show>
                {store.activeUser!.name}
              </strong>
            </span>
            <span class="badge badge-primary badge-outline badge-xs capitalize py-1.5 px-2 font-semibold">
              {store.activeUser!.type}
            </span>
          </div>
        </Show>
      </div>

      <div class="flex flex-col md:items-end gap-3 w-full md:w-auto max-w-md">
        {/* Navigation Tabs & Drawer Labels */}
        <div class="flex flex-wrap items-center gap-2">
          <A
            href="/"
            class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
              isBoard()
                ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            Board
          </A>
          <A
            href="/archived"
            class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
              isArchive()
                ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            Archive
          </A>
          <Show when={isParent()}>
            <A
              href="/analytics"
              class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
                isAnalytics()
                  ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                  : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              Analytics
            </A>
          </Show>
          <A
            href="/rewards"
            class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
              isRewards()
                ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            Scores & Rewards
          </A>
          <Show when={store.activeUser && store.activeUser.type === "child"}>
            <A
              href="/profile"
              class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
                isProfile()
                  ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                  : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              Profile & Badges
            </A>
          </Show>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            class="btn btn-ghost btn-sm btn-circle text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 cursor-pointer"
            title={
              theme() === "corporate"
                ? "Switch to Dark Mode"
                : "Switch to Light Mode"
            }
            aria-label="Toggle Theme"
          >
            <Show when={theme() === "corporate"} fallback={<span>☀️</span>}>
              <span>🌙</span>
            </Show>
          </button>

          {/* Log Out Button */}
          <button
            onClick={handleLogout}
            class="btn btn-ghost btn-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl font-semibold border-0 transition-all duration-200 cursor-pointer"
          >
            Log Out
          </button>

          <Show when={isParent()}>
            <A
              href="/settings"
              class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
                isSettings()
                  ? "btn-primary text-white shadow-md shadow-primary/20 hover:opacity-90"
                  : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              Settings
            </A>
            <label
              for="task-drawer"
              class="btn btn-primary btn-sm rounded-xl text-white font-bold border-0 cursor-pointer hover:opacity-90"
            >
              Add Task
            </label>
          </Show>
        </div>

        {/* User Switcher Dropdown */}
        <div class="flex w-full flex-col gap-1">
          <label
            for="active-user-id"
            class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
          >
            Switch User
          </label>
          <select
            id="active-user-id"
            class="select select-bordered select-sm w-full bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
            value={store.activeUser?.id || ""}
            onChange={handleUserSwitch}
          >
            <For each={switchableUsers()}>
              {(u) => (
                <option value={u.id} selected={u.id === store.activeUser?.id}>
                  {u.name} ({u.type})
                </option>
              )}
            </For>
          </select>
        </div>
      </div>
    </header>
  );
}
