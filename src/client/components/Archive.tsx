import { For, Show, createSignal, createMemo } from "solid-js";
import { store, storeActions } from "../store/app-store";
import { priorityStyles } from "./Board";
import type { Task } from "../../types";

export default function Archive() {
  // ── Local Filter States ───────────────────────────────
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedAssignee, setSelectedAssignee] = createSignal<string>("all");

  const [selectedPriority, setSelectedPriority] = createSignal<string>("all");

  // ── Assignee Name Helper ─────────────────────────────
  const getAssigneeName = (id: number | null | undefined) => {
    if (id == null) return "Unassigned";
    return store.users.find((u) => u.id === id)?.name || "Unknown";
  };

  // ── Filter Logic (Memoized) ──────────────────────────
  const archivedTasks = createMemo(() => {
    return store.tasks.filter((t) => t.status === "archived");
  });

  const filteredTasks = createMemo(() => {
    return archivedTasks().filter((task) => {
      // search match
      const matchesSearch = task.title
        .toLowerCase()
        .includes(searchQuery().toLowerCase());

      // Assignee filter match
      const matchesAssignee =
        selectedAssignee() === "all" ||
        (selectedAssignee() === "unassigned" && task.assigneeId === null) ||
        task.assigneeId?.toString() === selectedAssignee();

      // Priority filter match
      const matchesPriority =
        selectedPriority() === "all" || task.priority === selectedPriority();

      return matchesSearch && matchesAssignee && matchesPriority;
    });
  });

  // ── Handlers ─────────────────────────────────────────
  const handleRestore = (id: number) => {
    storeActions.updateTaskStatus(id, "todo");
  };

  const isRolloverArchive = (task: Task) =>
    task.repeat &&
    task.repeat !== "none" &&
    (task.archiveReason === "completed" || task.archiveReason === "missed");

  const handleDelete = (id: number) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this archived task? This cannot be undone.",
      )
    ) {
      storeActions.deleteTask(id);
    }
  };

  return (
    <section class="app-view archive-view max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header Area */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-black text-slate-100">
            Task archive
          </h2>
          <p class="text-slate-400 text-sm mt-1">
            Find finished work, restore a task, or clear old history.
          </p>
        </div>
        <div class="badge badge-lg bg-slate-900 border-slate-800 text-slate-300 font-bold px-4 py-3 rounded-xl shadow-inner">
          Total: {archivedTasks().length} tasks
        </div>
      </div>
      {/* Filter Control Bar */}
      <div class="view-panel grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        {/* Search Text */}
        <div class="flex flex-col gap-1">
          <label
            for="search-tasks"
            class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
          >
            Search Tasks
          </label>
          <input
            id="search-tasks"
            type="text"
            placeholder="Laundry"
            class="input input-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        {/* Filter by Assignee */}
        <div class="flex flex-col gap-1">
          <label
            for="filter-assignee"
            class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
          >
            Filter Assignee
          </label>
          <select
            id="filter-assignee"
            class="select select-bordered select-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
            value={selectedAssignee()}
            onChange={(e) => setSelectedAssignee(e.currentTarget.value)}
          >
            <option value="all">All Members</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((u) => u.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </div>
        {/* Filter by Priority */}
        <div class="flex flex-col gap-1">
          <label
            for="filter-priority"
            class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1"
          >
            Filter Priority
          </label>
          <select
            id="filter-priority"
            class="select select-bordered select-sm w-full bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200"
            value={selectedPriority()}
            onChange={(e) => setSelectedPriority(e.currentTarget.value)}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      {/* Archive Task Grid */}
      <Show
        when={archivedTasks().length > 0}
        fallback={
          <div class="rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/10 p-12 text-center max-w-md mx-auto mt-8">
            <span class="empty-mark" aria-hidden="true">A</span>
            <h3 class="text-lg font-bold text-slate-300 mt-4">
              Archive is empty
            </h3>
            <p class="text-xs text-slate-500 mt-2">
              Completed recurring tasks or manually moved items will appear
              here.
            </p>
          </div>
        }
      >
        <Show
          when={filteredTasks().length > 0}
          fallback={
            <div class="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 text-center max-w-md mx-auto mt-8">
              <span class="empty-mark" aria-hidden="true">0</span>
              <h3 class="text-md font-bold text-slate-400 mt-3">
                No matching tasks
              </h3>
              <p class="text-xs text-slate-600 mt-1">
                Try adjusting your filters or search terms.
              </p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={filteredTasks()}>
              {(task) => (
                <div class="archive-card group relative rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 flex flex-col justify-between min-h-35">
                  <div>
                    {/* Priority & Points Row */}
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <span
                        class={`text-[10px] font-bold uppercase tracking-wider rounded-lg border px-2 py-0.5 ${priorityStyles[task.priority] ?? ""}`}
                      >
                        {task.priority}
                      </span>
                      <span class="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/10">
                        {task.value} pts
                      </span>
                    </div>
                    {/* Task Title */}
                    <h3 class="text-sm font-bold text-slate-300 leading-snug line-clamp-2">
                      {task.title}
                    </h3>
                    <Show when={task.archiveReason}>
                      <span
                        class={`mt-2 inline-flex w-fit rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          task.archiveReason === "missed"
                            ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {task.archiveReason}
                      </span>
                    </Show>
                  </div>
                  {/* Card Footer (Assignee + Buttons) */}
                  <div class="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between gap-4">
                    <span class="text-[10px] text-slate-500 truncate max-w-30">
                      {getAssigneeName(task.assigneeId)}
                    </span>
                    <div class="flex items-center gap-1.5 shrink-0">
                      {/* Restore Button */}
                      <button
                        onClick={() => handleRestore(task.id)}
                        disabled={Boolean(isRolloverArchive(task))}
                        class="btn btn-xs rounded-lg font-semibold border-0 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 disabled:pointer-events-none disabled:opacity-40"
                        title={
                          isRolloverArchive(task)
                            ? "Recurring history cannot be restored"
                            : "Restore to active board"
                        }
                      >
                        Restore
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(task.id)}
                        class="btn btn-xs btn-ghost text-slate-500 hover:bg-rose-500/15 rounded-lg"
                        title="Permanently delete task"
                        aria-label={`Delete ${task.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  );
}
