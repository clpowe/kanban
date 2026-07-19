import { For, Show, createMemo, createSignal } from "solid-js";
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
      draggable
      onDragStart={handleDragStart}
    >
      <header>
        <h3>{props.task.title}</h3>
        <Show when={store.activeUser?.type === "parent"}>
          <button type="button" class="text-button danger" onClick={deleteTask}>
            Delete
          </button>
        </Show>
      </header>

      <div class="task-meta">
        <span>{props.task.priority}</span>
        <span>{props.task.value} pts</span>
        <Show when={props.task.repeat && props.task.repeat !== "none"}>
          <span>Repeats {props.task.repeat}</span>
        </Show>
      </div>

      <Show when={name()}>
        <p class="assignee">Assigned to <strong>{name()}</strong></p>
      </Show>

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
                <span>{level().icon} · {level().name}</span>
              </header>
              <progress
                value={achievement().currentStreak}
                max={achievement().targetStreak}
                aria-label={`${achievement().name} streak progress`}
              />
              <small>
                {achievement().currentStreak} of {achievement().targetStreak}
              </small>
            </section>
          );
        }}
      </Show>

      <Show when={props.column.nextStatus}>
        <button
          type="button"
          class="task-action"
          onClick={() =>
            storeActions.updateTaskStatus(props.task.id, props.column.nextStatus!)
          }
        >
          {props.column.nextLabel}
        </button>
      </Show>
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
        <div>
          <h1>Today’s tasks</h1>
          <p>Pick one up, move it forward, mark it done.</p>
        </div>

        <label>
          Assignee
          <select value={selectedChildId()} onChange={(event) => setSelectedChildId(event.currentTarget.value)}>
            <option value="all">All members</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((user) => user.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </label>
      </header>

      <section class="task-rhythm" aria-label="Visible task rhythm">
        <div class="bubble-matrix" aria-hidden="true">
          <For each={visibleBubbles()}>
            {(task) => <i data-status={task.status} />}
          </For>
        </div>
        <p>
          <strong>{visibleBubbles().length}</strong>
          active {visibleBubbles().length === 1 ? "task" : "tasks"} in view
        </p>
      </section>

      <div class="board-grid">
        <For each={columns}>
          {(column) => {
            const tasks = () => tasksByStatus()[column.key] ?? [];

            return (
              <section class="board-column" data-status={column.key}>
                <header>
                  <h2>{column.label}</h2>
                  <output>{tasks().length}</output>
                </header>

                <div
                  class="task-list"
                  data-drag-over={dragOverColumn() === column.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOverColumn(column.key);
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn() === column.key) setDragOverColumn(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverColumn(null);
                    const id = Number(event.dataTransfer?.getData("text/plain"));
                    if (!Number.isNaN(id)) storeActions.updateTaskStatus(id, column.key);
                  }}
                >
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
