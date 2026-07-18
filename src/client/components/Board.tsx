import { For, Show, createMemo, createSignal } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { Task } from "../../types";

export function getStreakLevel(
  current: number,
  target: number,
  prestige: number,
) {
  if (prestige > 0) {
    return {
      name: "Legend",
      color: "text-amber-400 border-amber-500/35 bg-amber-500/10",
      icon: "L",
    };
  }
  const ratio = current / target;
  if (ratio >= 0.75) {
    return {
      name: "Gold",
      color: "text-yellow-500 border-yellow-500/35 bg-yellow-500/10",
      icon: "G",
    };
  }
  if (ratio >= 0.5) {
    return {
      name: "Silver",
      color: "text-slate-350 border-slate-300/35 bg-slate-300/10",
      icon: "S",
    };
  }
  if (ratio >= 0.25) {
    return {
      name: "Bronze",
      color: "text-amber-700 border-amber-700/35 bg-amber-700/10",
      icon: "B",
    };
  }
  return {
    name: "None",
    color: "text-slate-500 border-slate-800 bg-slate-900/40",
    icon: "N",
  };
}

// ── Column config ──────────────────────────────────────

type ColumnDef = {
  key: string;
  label: string;
  accent: string; // border-top / badge color token
  emptyText: string;
  nextStatus?: string; // status to advance to on button click
  nextLabel?: string; // button label
};

const columns: ColumnDef[] = [
  {
    key: "todo",
    label: "To Do",
    accent: "blue",
    emptyText: "Nothing to do — nice!",
    nextStatus: "doing",
    nextLabel: "Start",
  },
  {
    key: "doing",
    label: "In Progress",
    accent: "gold",
    emptyText: "No tasks in progress.",
    nextStatus: "done",
    nextLabel: "Done ✓",
  },
  {
    key: "done",
    label: "Done",
    accent: "teal",
    emptyText: "Complete some tasks!",
  },
];

// ── Priority helpers ───────────────────────────────────

export const priorityStyles: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  low: "bg-sky-500/15 text-sky-400 border-sky-500/25",
};

const accentMap: Record<
  string,
  { border: string; bg: string; text: string; glow: string }
> = {
  blue: {
    border: "board-accent-border--blue",
    bg: "board-accent-bg--blue",
    text: "board-accent-text--blue",
    glow: "board-accent-glow--blue",
  },
  gold: {
    border: "board-accent-border--gold",
    bg: "board-accent-bg--gold",
    text: "board-accent-text--gold",
    glow: "board-accent-glow--gold",
  },
  teal: {
    border: "board-accent-border--teal",
    bg: "board-accent-bg--teal",
    text: "board-accent-text--teal",
    glow: "board-accent-glow--teal",
  },
};

// ── Assignee name lookup ───────────────────────────────
function assigneeName(id: number | null | undefined): string | undefined {
  if (id == null) return undefined;
  return store.users.find((u) => u.id === id)?.name;
}

// ── TaskCard ───────────────────────────────────────────
function TaskCard(props: { task: Task; col: ColumnDef }) {
  const name = () => assigneeName(props.task.assigneeId);
  const handleAdvance = () => {
    if (props.col.nextStatus) {
      storeActions.updateTaskStatus(props.task.id, props.col.nextStatus);
    }
  };

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData("text/plain", props.task.id.toString());
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      class="task-card group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg"
    >
      {/* Title */}
      <div class="task-card__title-row flex items-start justify-between gap-2">
        <h3 class="task-card__title text-sm font-bold text-slate-100 leading-snug">
          {props.task.title}
        </h3>
        <Show when={store.activeUser?.type === "parent"}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (
                confirm(
                  "Are you sure you want to permanently delete this task? This cannot be undone.",
                )
              ) {
                storeActions.deleteTask(props.task.id);
              }
            }}
            class="task-card__delete btn btn-xs btn-ghost text-slate-500 hover:bg-rose-500/15 rounded-lg shrink-0 px-2"
            title="Permanently delete task"
            aria-label={`Delete ${props.task.title}`}
          >
            Delete
          </button>
        </Show>
      </div>
      {/* Meta row: priority + points */}
      <div class="task-card__meta flex items-center gap-2 flex-wrap">
        <span
          class={`text-[10px] font-bold uppercase tracking-wider rounded-lg border px-2 py-0.5 ${priorityStyles[props.task.priority] ?? ""}`}
        >
          {props.task.priority}
        </span>
        <span class="task-card__points text-xs font-semibold text-slate-400">
          {props.task.value} pts
        </span>
        <Show when={props.task.repeat && props.task.repeat !== "none"}>
          <span class="task-card__repeat text-[10px] font-semibold text-slate-400 bg-slate-800/30 border border-slate-700/40 rounded-lg px-2 py-0.5 capitalize">
            Repeats {props.task.repeat}
          </span>
        </Show>
      </div>
      {/* Assignee */}
      <Show when={name()}>
        <p class="task-card__assignee text-[11px] text-slate-500">
          <span>Assigned to</span> <strong class="text-slate-300">{name()}</strong>
        </p>
      </Show>

      {/* Streak Achievement Progress */}
      <Show when={props.task.achievement}>
        {(() => {
          const ach = props.task.achievement!;
          const lvl = () =>
            getStreakLevel(
              ach.currentStreak,
              ach.targetStreak,
              ach.prestigeCount,
            );
          const pct = () =>
            Math.min(
              100,
              Math.round((ach.currentStreak / ach.targetStreak) * 100),
            );

          return (
            <div class="task-card__goal mt-2.5 mb-2.5 p-2 rounded-xl bg-slate-950/30 border border-slate-800/80 flex flex-col gap-1.5 text-xs">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                  Goal · {ach.name}
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    class={`text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-lg border ${lvl().color}`}
                  >
                    {lvl().icon} {lvl().name}
                  </span>
                  <Show when={ach.prestigeCount > 0}>
                    <span
                      class="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1 rounded-md"
                      title={`Prestiged ${ach.prestigeCount} times`}
                    >
                      {ach.prestigeCount}×
                    </span>
                  </Show>
                </div>
              </div>
              {/* Progress bar */}
              <div class="flex items-center gap-2">
                <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${pct()}%` }}
                  />
                </div>
                <span class="text-[10px] font-bold text-slate-500 select-none whitespace-nowrap">
                  {ach.currentStreak}/{ach.targetStreak}
                </span>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* Advance button */}
      <Show when={props.col.nextStatus}>
        <button
          onClick={handleAdvance}
          class="task-card__action btn btn-sm w-full rounded-xl font-semibold border-0 bg-slate-800 text-slate-300 hover:bg-primary"
        >
          {props.col.nextLabel}
        </button>
      </Show>
    </div>
  );
}

// ── Board (exported default) ───────────────────────────
export default function Board() {
  const [dragOverCol, setDragOverCol] = createSignal<string | null>(null);
  const [selectedChildId, setSelectedChildId] = createSignal<string>("all");

  const filteredTasks = createMemo(() => {
    const filterVal = selectedChildId();
    if (filterVal === "all") {
      return store.tasks;
    }
    if (filterVal === "unassigned") {
      return store.tasks.filter(
        (t) => t.assigneeId === null || t.assigneeId === undefined,
      );
    }

    const targetId = Number(filterVal);
    return store.tasks.filter((t) => t.assigneeId === targetId);
  });

  // Derive column task lists reactively
  const tasksByStatus = createMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
      map[col.key] = filteredTasks().filter((t) => t.status === col.key);
    }
    return map;
  });

  return (
    <section class="task-board">
      {/* Board Header & Filter */}
      <div class="board-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 p-4">
        <div>
          <h2 class="text-3xl font-bold text-slate-100">Today’s tasks</h2>
          <p class="text-xs text-slate-400">
            Pick one up, move it forward, mark it done.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label
            for="board-child-filter"
            class="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Assignee:
          </label>
          <select
            id="board-child-filter"
            class="select select-sm select-bordered bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 text-xs py-1"
            value={selectedChildId()}
            onChange={(e) => setSelectedChildId(e.currentTarget.value)}
          >
            <option value="all">All Members</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((u) => u.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </div>
      </div>
      <div class="board-grid grid grid-cols-1 md:grid-cols-3 gap-5">
        <For each={columns}>
          {(col) => {
            const a = accentMap[col.accent];
            const tasks = () => tasksByStatus()[col.key] ?? [];
            const isOver = () => dragOverCol() === col.key;

            return (
              <div class={`board-column board-column--${col.accent} flex flex-col gap-3 min-w-0`}>
                {/* Column header */}
                <div
                  class={`flex items-center gap-2 rounded-xl border ${a?.border} ${a?.bg} px-4 py-2`}
                >
                  <span
                    class={`text-xs font-extrabold uppercase tracking-widest ${a?.text}`}
                  >
                    {col.label}
                  </span>
                  <span
                    class={`ml-auto text-xs font-bold ${a?.text} opacity-70`}
                  >
                    {tasks().length}
                  </span>
                </div>
                {/* Cards drop-zone container */}
                <div
                  class={`task-dropzone flex flex-col gap-3 min-h-125 rounded-2xl p-2 ${
                    isOver()
                      ? "bg-slate-900/40 ring-2 ring-primary/20 border border-slate-800/80"
                      : "bg-transparent border border-transparent"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }}
                  onDragLeave={() => {
                    if (dragOverCol() === col.key) {
                      setDragOverCol(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    setDragOverCol(null);
                    const idStr = e.dataTransfer?.getData("text/plain");
                    if (idStr) {
                      const id = Number(idStr);
                      if (!isNaN(id)) {
                        storeActions.updateTaskStatus(id, col.key);
                      }
                    }
                  }}
                >
                  {/* Cards */}
                  <div class="flex flex-col gap-3">
                    <For
                      each={tasks()}
                      fallback={
                        <div class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center">
                          <p class="text-xs text-slate-600 italic">
                            {col.emptyText}
                          </p>
                        </div>
                      }
                    >
                      {(task) => <TaskCard task={task} col={col} />}
                    </For>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
}
