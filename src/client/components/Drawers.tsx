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
  const [attachAchievement, setAttachAchievement] = createSignal(false);
  const [achievementName, setAchievementName] = createSignal("");
  const [targetStreak, setTargetStreak] = createSignal(20);

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

    if (
      attachAchievement() &&
      achievementName().trim() &&
      (taskRepeat() === "daily" || taskRepeat() === "weekly")
    ) {
      newTask.achievementName = achievementName().trim();
      newTask.targetStreak = Number(targetStreak());
    }

    const result = await storeActions.addTask(newTask);
    if (result) {
      // Reset form
      setTaskTitle("");
      setTaskPriority("medium");
      setTaskRepeat("none");
      setTaskAssigneeId("");
      setAttachAchievement(false);
      setAchievementName("");
      setTargetStreak(20);

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

      {/* Inner page content (Header + Main App Pages) */}
      <div class="drawer-content min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {props.children}
        </main>
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
                <h2 class="text-xl font-black text-slate-100">
                  Create New Task
                </h2>
              </div>
              <label
                for="task-drawer"
                class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
                {/* Custom Streak Achievement Option (For Repeatable tasks only) */}
                <Show
                  when={taskRepeat() === "daily" || taskRepeat() === "weekly"}
                >
                  <div class="flex flex-col gap-2 bg-slate-950/40 border border-slate-800 rounded-xl p-3 mt-1.5">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs checkbox-primary border-slate-700 bg-slate-900"
                        checked={attachAchievement()}
                        onChange={(e) =>
                          setAttachAchievement(e.currentTarget.checked)
                        }
                      />
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                        Attach Custom Achievement
                      </span>
                    </label>
                    <Show when={attachAchievement()}>
                      <div class="flex flex-col gap-2 mt-1.5 animate-fade-in">
                        <div class="flex flex-col gap-1">
                          <label class="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                            Achievement Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Room Cleaning Legend"
                            class="input input-xs bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-200"
                            value={achievementName()}
                            onInput={(e) =>
                              setAchievementName(e.currentTarget.value)
                            }
                            required={attachAchievement()}
                          />
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                            Target Streak (
                            {taskRepeat() === "daily" ? "days" : "weeks"})
                          </label>
                          <input
                            type="number"
                            min="1"
                            class="input input-xs bg-slate-900 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg text-slate-200"
                            value={targetStreak()}
                            onInput={(e) =>
                              setTargetStreak(Number(e.currentTarget.value))
                            }
                            required={attachAchievement()}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
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
