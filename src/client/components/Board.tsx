import { For, Show, createMemo, createSignal } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { Task } from "../../types";

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
    accent: "indigo",
    emptyText: "Nothing to do — nice!",
    nextStatus: "doing",
    nextLabel: "Start",
  },
  {
    key: "doing",
    label: "In Progress",
    accent: "amber",
    emptyText: "No tasks in progress.",
    nextStatus: "done",
    nextLabel: "Done ✓",
  },
  {
    key: "done",
    label: "Done",
    accent: "emerald",
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
  indigo: {
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    glow: "bg-indigo-500/10",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "bg-amber-500/10",
  },
  emerald: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "bg-emerald-500/10",
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
      class="group relative rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-4 shadow-lg hover:border-slate-700 hover:shadow-xl transition-all duration-200"
    >
      {/* Title */}
      <h3 class="text-sm font-bold text-slate-100 leading-snug mb-2">
        {props.task.title}
      </h3>
      {/* Meta row: priority + points */}
      <div class="flex items-center gap-2 flex-wrap mb-3">
        <span
          class={`text-[10px] font-bold uppercase tracking-wider rounded-lg border px-2 py-0.5 ${priorityStyles[props.task.priority] ?? ""}`}
        >
          {props.task.priority}
        </span>
        <span class="text-xs font-semibold text-slate-400">
          ⭐ {props.task.value} pts
        </span>
        <Show when={props.task.repeat && props.task.repeat !== "none"}>
          <span class="text-[10px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-0.5 capitalize">
            🔁 {props.task.repeat}
          </span>
        </Show>
      </div>
      {/* Assignee */}
      <Show when={name()}>
        <p class="text-[11px] text-slate-500 mb-3">
          Assigned to <strong class="text-slate-300">{name()}</strong>
        </p>
      </Show>
      {/* Advance button */}
      <Show when={props.col.nextStatus}>
        <button
          onClick={handleAdvance}
          class="btn btn-sm w-full rounded-xl font-semibold border-0 transition-all duration-200 bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white hover:shadow-md hover:shadow-indigo-600/20"
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
  // Derive column task lists reactively
  const tasksByStatus = createMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
      map[col.key] = store.tasks.filter((t) => t.status === col.key);
    }
    return map;
  });

  return (
    <section class="px-4 py-6 md:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <For each={columns}>
          {(col) => {
            const a = accentMap[col.accent];
            const tasks = () => tasksByStatus()[col.key] ?? [];
            const isOver = () => dragOverCol() === col.key;

            return (
              <div class="flex flex-col gap-3 min-w-0">
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
                  class={`flex flex-col gap-3 min-h-125 rounded-2xl p-2 transition-all duration-200 ${
                    isOver()
                      ? "bg-slate-900/40 ring-2 ring-indigo-500/20 border border-slate-800/80"
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
