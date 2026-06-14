import { Show, For, createSignal } from "solid-js";
import type { ParentProps } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { CreateTask } from "../../types";
import AnimatedPoints from "./AnimatedPoints";

export default function Drawers(props: ParentProps) {
  const isParent = () => store.activeUser?.type === "parent";

  // ── Form States for Adding a Task ─────────────────────
  const [taskTitle, setTaskTitle] = createSignal("");
  const [taskPriority, setTaskPriority] = createSignal<
    "low" | "medium" | "high"
  >("medium");
  const [taskRepeat, setTaskRepeat] = createSignal<"none" | "daily" | "weekly">(
    "none",
  );
  const [taskAssigneeId, setTaskAssigneeId] = createSignal<string>("");



  // ── Action Handlers ──────────────────────────────────
  const handleAddTask = async (e: Event) => {
    e.preventDefault();
    if (!taskTitle().trim()) return;

    const assigneeIdVal = taskAssigneeId();
    const assigneeId = assigneeIdVal === "" ? null : Number(assigneeIdVal);

    const newTask: CreateTask = {
      title: taskTitle().trim(),
      priority: taskPriority(),
      repeat: taskRepeat(),
      assigneeId,
    };

    const result = await storeActions.addTask(newTask);
    if (result) {
      // Reset form
      setTaskTitle("");
      setTaskPriority("medium");
      setTaskRepeat("none");
      setTaskAssigneeId("");

      // Programmatically close task drawer
      const toggle = document.getElementById(
        "task-drawer",
      ) as HTMLInputElement | null;
      if (toggle) toggle.checked = false;
    }
  };



  const handleRedeem = async (id: number) => {
    await storeActions.redeemReward(id);
  };
  // Sort users for the leaderboard (highest points first)
  const sortedUsers = () => {
    return [...store.users]
      .filter((u) => u.type === "child")
      .sort((a, b) => b.points - a.points);
  };

  return (
    <div class="drawer drawer-end">
      <input id="task-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content">
        <div class="drawer drawer-end">
          <input id="score-drawer" type="checkbox" class="drawer-toggle" />

          {/* Inner page content (Header + Main App Pages) */}
          <div class="drawer-content min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
              {props.children}
            </main>
          </div>
          {/* ── SCORE & REWARDS DRAWER SIDEBAR ────────────────── */}
          <div class="drawer-side z-30">
            <label
              for="score-drawer"
              aria-label="close sidebar"
              class="drawer-overlay"
            ></label>
            <div class="flex min-h-full w-full max-w-md flex-col gap-6 bg-slate-900 border-l border-slate-800 p-5 shadow-2xl overflow-y-auto">
              {/* Drawer Header */}
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                    Household Portal
                  </span>
                  <h2 class="text-xl font-black text-white">
                    Scores & Rewards
                  </h2>
                </div>
                <label
                  for="score-drawer"
                  class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </label>
              </div>
              {/* Section 1: Leaderboard */}
              <section class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  🏆 Family Leaderboard
                </h3>
                <ul class="divide-y divide-slate-800/60">
                  <For each={sortedUsers()}>
                    {(u) => (
                      <li class="flex items-center justify-between py-2.5">
                        <div class="flex flex-col">
                          <span class="text-sm font-bold text-slate-200">
                            {u.name}
                          </span>
                          <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {u.type}
                          </span>
                        </div>
                        <span class="badge font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3.5 py-3 rounded-lg">
                          ⭐ <AnimatedPoints value={u.points} /> pts
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
              {/* Section 2: Rewards Center */}
              <section class="flex flex-col gap-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">
                  🎁 Reward Store
                </h3>
                <ul class="flex flex-col gap-3">
                  <For
                    each={store.rewards}
                    fallback={
                      <li class="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500 italic">
                        No rewards configured yet.
                      </li>
                    }
                  >
                    {(reward) => {
                      const activeUserPoints = () =>
                        store.activeUser?.points || 0;
                      const canAfford = () => activeUserPoints() >= reward.cost;
                      const shortfall = () => reward.cost - activeUserPoints();
                      return (
                        <li class="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/20">
                          <div class="min-w-0">
                            <p class="font-bold text-sm text-slate-200 truncate">
                              {reward.title}
                            </p>
                            <p class="text-xs font-semibold text-slate-400 mt-0.5">
                              ⭐ {reward.cost} pts
                            </p>
                          </div>
                          <Show
                            when={isParent()}
                            fallback={
                              <Show
                                when={canAfford()}
                                fallback={
                                  <div class="flex flex-col items-end gap-1">
                                    <button
                                      class="btn btn-xs rounded-lg bg-slate-800 text-slate-500 cursor-not-allowed"
                                      disabled
                                    >
                                      Redeem
                                    </button>
                                    <span class="text-[9px] font-bold text-rose-400">
                                      Need {shortfall()} more
                                    </span>
                                  </div>
                                }
                              >
                                <button
                                  onClick={() => handleRedeem(reward.id)}
                                  class="btn btn-xs rounded-lg font-bold border-0 bg-teal-400 hover:bg-teal-300 text-slate-950"
                                >
                                  Redeem
                                </button>
                              </Show>
                            }
                          >
                            <span class="badge text-xs font-semibold bg-slate-800 text-slate-300 border-0 rounded-lg">
                              {reward.cost} pts
                            </span>
                          </Show>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
      {/* ── PARENT CREATION DRAWER SIDEBAR ────────────────── */}
      <Show when={isParent()}>
        <div class="drawer-side z-20">
          <label
            for="task-drawer"
            aria-label="close sidebar"
            class="drawer-overlay"
          ></label>
          <div class="flex min-h-full w-full max-w-md flex-col gap-6 bg-slate-900 border-l border-slate-800 p-5 shadow-2xl overflow-y-auto">
            {/* Drawer Header */}
            <div class="flex items-center justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                  Manager Dashboard
                </span>
                <h2 class="text-xl font-black text-white">Create New Task</h2>
              </div>
              <label
                for="task-drawer"
                class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </label>
            </div>
            {/* Task Form */}
            <section class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                📝 Add New Task
              </h3>
              <form onSubmit={handleAddTask} class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                  <input
                    type="text"
                    placeholder="Task title..."
                    class="input input-sm bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                    value={taskTitle()}
                    onInput={(e) => setTaskTitle(e.currentTarget.value)}
                    required
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1">
                    <label class="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                      Priority
                    </label>
                    <select
                      class="select select-sm bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                      value={taskPriority()}
                      onChange={(e) =>
                        setTaskPriority(e.currentTarget.value as any)
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                      Repeat
                    </label>
                    <select
                      class="select select-sm bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                      value={taskRepeat()}
                      onChange={(e) =>
                        setTaskRepeat(e.currentTarget.value as any)
                      }
                    >
                      <option value="none">No Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    Assignee
                  </label>
                  <select
                    class="select select-sm bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
                    value={taskAssigneeId()}
                    onChange={(e) => setTaskAssigneeId(e.currentTarget.value)}
                  >
                    <option value="">Unassigned</option>
                    <For each={store.users.filter((u) => u.type === "child")}>
                      {(user) => <option value={user.id}>{user.name}</option>}
                    </For>
                  </select>
                </div>
                <button
                  type="submit"
                  class="btn btn-sm rounded-xl font-bold border-0 bg-indigo-600 hover:bg-indigo-500 text-white mt-2"
                >
                  Add Task
                </button>
              </form>
            </section>
          </div>
        </div>
      </Show>
    </div>
  );
}

