import { Show, For } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { authClient } from "../lib/auth-client";

export default function Navbar() {
  const location = useLocation();

  const isBoard = () => location.pathname === "/";
  const isArchive = () => location.pathname === "/archived";
  const isParent = () => store.activeUser?.type === "parent";

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
        <span class="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Household Board
        </span>
        <h1 class="text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Family Task
        </h1>
        <Show when={store.activeUser}>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs text-slate-400">
              Active:{" "}
              <strong class="text-slate-200">{store.activeUser!.name}</strong>
            </span>
            <span class="badge badge-indigo badge-xs capitalize border border-indigo-500/20 py-1.5 px-2 bg-indigo-500/10 text-indigo-300 font-semibold">
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
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            Board
          </A>
          <A
            href="/archived"
            class={`btn btn-sm rounded-xl font-semibold border-0 transition-all duration-200 ${
              isArchive()
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                : "bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            Archive
          </A>

          <label
            for="score-drawer"
            class="btn btn-outline btn-sm rounded-xl border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-300 cursor-pointer"
          >
            Scores & Rewards
          </label>

          <Show when={isParent()}>
            <label
              for="task-drawer"
              class="btn btn-accent btn-sm rounded-xl text-slate-950 font-bold border-0 bg-teal-400 hover:bg-teal-300 cursor-pointer"
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
            <For each={store.users}>
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
