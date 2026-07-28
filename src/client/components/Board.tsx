import { For, Show, createMemo, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import type { Task } from "../../types";

export function getStreakLevel(current: number, target: number, prestige: number) {
  if (prestige > 0) return { name: "Legend", icon: "L", tone: "yellow" };

  const ratio = current / target;
  if (ratio >= 0.75) return { name: "Gold", icon: "G", tone: "yellow" };
  if (ratio >= 0.5) return { name: "Silver", icon: "S", tone: "blue" };
  if (ratio >= 0.25) return { name: "Bronze", icon: "B", tone: "coral" };
  return { name: "Starting", icon: "N", tone: "neutral" };
}

type ColumnDef = {
  key: string;
  label: string;
  emptyText: string;
  nextStatus?: string;
  nextLabel?: string;
};

const columns: ColumnDef[] = [
  {
    key: "todo",
    label: "To do",
    emptyText: "Nothing waiting here.",
    nextStatus: "doing",
    nextLabel: "Start",
  },
  {
    key: "doing",
    label: "In progress",
    emptyText: "No tasks in progress.",
    nextStatus: "done",
    nextLabel: "Mark done",
  },
  {
    key: "done",
    label: "Done",
    emptyText: "Finished tasks land here.",
  },
];

function assigneeName(id: number | null | undefined) {
  if (id == null) return undefined;
  return store.users.find((user) => user.id === id)?.name;
}

function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TaskCard(props: { task: Task; column: ColumnDef }) {
  const name = () => assigneeName(props.task.assigneeId);

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer?.setData("text/plain", props.task.id.toString());
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const deleteTask = () => {
    const confirmed = window.confirm(
      `Permanently delete “${props.task.title}”? This cannot be undone.`,
    );
    if (confirmed) storeActions.deleteTask(props.task.id);
  };

  return (
    <article
      class="task-card"
      data-priority={props.task.priority}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <header class="task-card-header">
        <span class="issue-number">#{props.task.id}</span>
        <Show when={store.activeUser?.type === "parent"}>
          <button
            type="button"
            class="card-delete"
            aria-label={`Delete ${props.task.title}`}
            onClick={deleteTask}
          >
            Delete
          </button>
        </Show>
      </header>

      <h3>{props.task.title}</h3>

      <div class="task-labels" aria-label="Task metadata">
        <span data-priority={props.task.priority}>{props.task.priority} priority</span>
        <span class="points-label">{props.task.value} pts</span>
        <Show when={props.task.repeat && props.task.repeat !== "none"}>
          <span class="repeat-label">{props.task.repeat}</span>
        </Show>
      </div>

      <Show when={props.task.achievement}>
        {(achievement) => {
          const level = () =>
            getStreakLevel(
              achievement().currentStreak,
              achievement().targetStreak,
              achievement().prestigeCount,
            );

          return (
            <section class="task-streak" data-tone={level().tone}>
              <header>
                <strong>{achievement().name}</strong>
                <span>{level().icon} · {achievement().currentStreak}/{achievement().targetStreak}</span>
              </header>
              <progress
                value={achievement().currentStreak}
                max={achievement().targetStreak}
                aria-label={`${achievement().name} streak progress`}
              />
            </section>
          );
        }}
      </Show>

      <footer class="task-card-footer">
        <span class="assignee-chip" title={name() ? `Assigned to ${name()}` : "Unassigned"}>
          <i aria-hidden="true">{initials(name())}</i>
          <span>{name() || "Unassigned"}</span>
        </span>

        <Show when={props.column.nextStatus}>
          <button
            type="button"
            class="task-action"
            onClick={() =>
              storeActions.updateTaskStatus(props.task.id, props.column.nextStatus!)
            }
          >
            {props.column.nextLabel}
            <span aria-hidden="true">→</span>
          </button>
        </Show>
      </footer>
    </article>
  );
}

export default function Board() {
  const [dragOverColumn, setDragOverColumn] = createSignal<string | null>(null);
  const [selectedChildId, setSelectedChildId] = createSignal("all");

  const filteredTasks = createMemo(() => {
    if (selectedChildId() === "all") return store.tasks;
    if (selectedChildId() === "unassigned") {
      return store.tasks.filter((task) => task.assigneeId == null);
    }

    return store.tasks.filter(
      (task) => task.assigneeId === Number(selectedChildId()),
    );
  });

  const tasksByStatus = createMemo(() =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        filteredTasks().filter((task) => task.status === column.key),
      ]),
    ) as Record<string, Task[]>,
  );

  const visibleBubbles = createMemo(() =>
    filteredTasks()
      .filter((task) => task.status !== "archived")
      .slice(0, 24),
  );

  return (
    <section class="app-view board-view">
      <header class="board-lead">
        <nav class="project-breadcrumb" aria-label="Breadcrumb">
          <span>Family Task</span>
          <span aria-hidden="true">/</span>
          <strong>Household board</strong>
        </nav>

        <div class="board-title-row">
          <span class="project-mark" aria-hidden="true">
            FT
          </span>
          <div>
            <h1>Household tasks</h1>
            <p>Plan the work, share the load, and keep the house moving.</p>
          </div>
        </div>

        <nav class="view-tabs" aria-label="Project views">
          <span aria-current="page">Board</span>
          <A href="/archived">Archive</A>
        </nav>
      </header>

      <form class="board-toolbar" onSubmit={(event) => event.preventDefault()}>
        <label class="toolbar-select">
          <span>Assignee</span>
          <select value={selectedChildId()} onChange={(event) => setSelectedChildId(event.currentTarget.value)}>
            <option value="all">All members</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((user) => user.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </label>
      </form>

      <section class="board-pulse" aria-label="Visible task summary">
        <div class="pulse-copy">
          <span class="pulse-icon" aria-hidden="true">◎</span>
          <p>
            <strong>{visibleBubbles().length} active {visibleBubbles().length === 1 ? "task" : "tasks"}</strong>
            <span>Drag cards between columns to update their status.</span>
          </p>
        </div>

        <div class="pulse-track" aria-hidden="true">
          <For each={visibleBubbles()}>
            {(task) => <i data-status={task.status} />}
          </For>
        </div>

        <dl class="pulse-totals">
          <For each={columns}>
            {(column) => (
              <div data-status={column.key}>
                <dt>{column.label}</dt>
                <dd>{tasksByStatus()[column.key]?.length ?? 0}</dd>
              </div>
            )}
          </For>
        </dl>
      </section>

      <div class="board-grid">
        <For each={columns}>
          {(column) => {
            const tasks = () => tasksByStatus()[column.key] ?? [];

            return (
              <section
                class="board-column"
                data-status={column.key}
                data-drag-over={dragOverColumn() === column.key}
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOverColumn(column.key);
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget;

                  if (
                    nextTarget instanceof Node &&
                    (event.currentTarget as HTMLElement).contains(nextTarget)
                  ) {
                    return;
                  }

                  if (dragOverColumn() === column.key) setDragOverColumn(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverColumn(null);
                  const id = Number(event.dataTransfer?.getData("text/plain"));
                  if (!Number.isNaN(id)) {
                    storeActions.updateTaskStatus(id, column.key);
                  }
                }}
              >
                <header class="column-header">
                  <div>
                    <span class="status-dot" aria-hidden="true" />
                    <h2>{column.label}</h2>
                    <output>{tasks().length}</output>
                  </div>
                </header>

                <div class="task-list">
                  <For each={tasks()} fallback={<p class="empty-state">{column.emptyText}</p>}>
                    {(task) => <TaskCard task={task} column={column} />}
                  </For>
                </div>
              </section>
            );
          }}
        </For>
      </div>
    </section>
  );
}
