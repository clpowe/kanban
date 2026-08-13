import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import type { Task } from "../../types";
import { isVisibleStreak } from "../lib/streak-visibility";

export function getStreakLevel(current: number, target: number, prestige: number) {
  if (prestige > 0) return { name: "Legend", icon: "L", tone: "yellow" };

  const ratio = current / target;
  if (ratio >= 0.75) return { name: "Gold", icon: "G", tone: "yellow" };
  if (ratio >= 0.5) return { name: "Silver", icon: "S", tone: "blue" };
  if (ratio >= 0.25) return { name: "Bronze", icon: "B", tone: "coral" };
  return { name: "Starting", icon: "N", tone: "neutral" };
}

type ColumnDef = {
  key: "todo" | "doing" | "done";
  label: string;
  emptyText: string;
  nextStatus?: "todo" | "doing" | "done";
  nextLabel?: string;
};

type ViewMode = "board" | "list";
type PriorityFilter = "all" | "high" | "medium" | "low";
type SortMode = "board" | "priority" | "assignee";

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
    nextStatus: "todo",
    nextLabel: "Undo",
  },
];

const priorityRank: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

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

function statusLabel(status: Task["status"]) {
  if (status === "doing") return "In progress";
  if (status === "todo") return "To do";
  if (status === "done") return "Done";
  if (status === "review") return "Review";
  return "Archived";
}

function openTaskDialog() {
  const dialog = document.getElementById("task-dialog") as HTMLDialogElement | null;
  if (dialog && !dialog.open) dialog.showModal();
}

function TaskCard(props: {
  task: Task;
  column: ColumnDef;
  compact: boolean;
  showStreaks: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const name = () => assigneeName(props.task.assigneeId);
  const canUpdateStatus = () =>
    store.activeUser?.type === "parent" ||
    props.task.assigneeId === store.activeUser?.id;

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer?.setData("text/plain", props.task.id.toString());
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  return (
    <article
      class="task-card"
      data-priority={props.task.priority}
      data-compact={props.compact}
      data-selected={props.selected}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <header class="task-card-header">
        <span class="issue-number">Task {props.task.id}</span>
        <span class="priority-marker" data-priority={props.task.priority}>
          {props.task.priority}
        </span>
      </header>

      <h3>
        <button type="button" class="task-card-open" onClick={props.onOpen}>
          {props.task.title}
        </button>
      </h3>

      <Show when={!props.compact}>
        <div class="task-labels" aria-label="Task metadata">
          <span class="points-label">{props.task.value} points</span>
          <Show when={props.task.repeat && props.task.repeat !== "none"}>
            <span class="repeat-label">{props.task.repeat}</span>
          </Show>
        </div>
      </Show>

      <Show
        when={
          props.showStreaks && isVisibleStreak(props.task.achievement)
            ? props.task.achievement
            : null
        }
      >
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
                <span>
                  {achievement().currentStreak}/{achievement().targetStreak}
                </span>
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

        <Show when={props.column.nextStatus && canUpdateStatus()}>
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

function TaskInspector(props: { task: Task; onClose: () => void }) {
  const [title, setTitle] = createSignal("");
  const [priority, setPriority] = createSignal<Task["priority"]>("medium");
  const [status, setStatus] = createSignal<Task["status"]>("todo");
  const [repeat, setRepeat] = createSignal<"none" | "daily" | "weekly">("none");
  const [assigneeId, setAssigneeId] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const isParent = () => store.activeUser?.type === "parent";
  const canUpdateStatus = () =>
    isParent() || props.task.assigneeId === store.activeUser?.id;
  const assignedName = () => assigneeName(props.task.assigneeId) || "Unassigned";

  createEffect(() => {
    setTitle(props.task.title);
    setPriority(props.task.priority);
    setStatus(props.task.status);
    setRepeat(props.task.repeat || "none");
    setAssigneeId(props.task.assigneeId == null ? "" : String(props.task.assigneeId));
  });

  const saveChanges = async (event: Event) => {
    event.preventDefault();
    if (!title().trim()) return;

    const taskId = props.task.id;
    const currentStatus = props.task.status;
    const nextStatus = status();

    setSaving(true);
    try {
      await storeActions.updateTask(taskId, {
        title: title().trim(),
        priority: priority(),
        repeat: repeat(),
        assigneeId: assigneeId() === "" ? null : Number(assigneeId()),
      });

      if (nextStatus !== currentStatus) {
        await storeActions.updateTaskStatus(taskId, nextStatus);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    const confirmed = window.confirm(
      `Permanently delete “${props.task.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    await storeActions.deleteTask(props.task.id);
    props.onClose();
  };

  const advanceTask = () => {
    if (props.task.status === "todo") {
      storeActions.updateTaskStatus(props.task.id, "doing");
    } else if (props.task.status === "doing") {
      storeActions.updateTaskStatus(props.task.id, "done");
    }
  };

  return (
    <aside class="task-inspector" aria-labelledby="task-inspector-title">
      <header class="task-inspector-header">
        <div>
          <span>Task {props.task.id}</span>
          <h2 id="task-inspector-title">{props.task.title}</h2>
        </div>
        <button
          type="button"
          class="icon-button inspector-close"
          aria-label="Close task details"
          onClick={props.onClose}
        >
          ×
        </button>
      </header>

      <Show
        when={isParent()}
        fallback={
          <div class="task-inspector-body">
            <dl class="task-facts">
              <div>
                <dt>Status</dt>
                <dd><span class="status-chip" data-status={props.task.status}>{statusLabel(props.task.status)}</span></dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>{assignedName()}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd class="capitalize">{props.task.priority}</dd>
              </div>
              <div>
                <dt>Reward</dt>
                <dd>{props.task.value} points</dd>
              </div>
              <div>
                <dt>Repeats</dt>
                <dd class="capitalize">{props.task.repeat || "none"}</dd>
              </div>
            </dl>

            <Show
              when={
                isVisibleStreak(props.task.achievement)
                  ? props.task.achievement
                  : null
              }
            >
              {(achievement) => (
                <section class="inspector-streak">
                  <span>Current streak</span>
                  <strong>{achievement().name}</strong>
                  <progress
                    value={achievement().currentStreak}
                    max={achievement().targetStreak}
                    aria-label={`${achievement().name} streak progress`}
                  />
                  <small>{achievement().currentStreak} of {achievement().targetStreak}</small>
                </section>
              )}
            </Show>

            <Show
              when={
                canUpdateStatus() &&
                (props.task.status === "todo" || props.task.status === "doing")
              }
            >
              <button type="button" class="primary inspector-primary" onClick={advanceTask}>
                {props.task.status === "todo" ? "Start task" : "Mark done"}
              </button>
            </Show>
          </div>
        }
      >
        <form class="task-inspector-form" onSubmit={saveChanges}>
          <label class="inspector-title-field">
            Task name
            <input
              type="text"
              value={title()}
              onInput={(event) => setTitle(event.currentTarget.value)}
              required
            />
          </label>

          <div class="inspector-field-grid">
            <label>
              Status
              <select
                value={status()}
                onChange={(event) => setStatus(event.currentTarget.value as Task["status"])}
              >
                <option value="todo">To do</option>
                <option value="doing">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label>
              Assignee
              <select value={assigneeId()} onChange={(event) => setAssigneeId(event.currentTarget.value)}>
                <option value="">Unassigned</option>
                <For each={store.users.filter((user) => user.type === "child")}>
                  {(user) => <option value={user.id}>{user.name}</option>}
                </For>
              </select>
            </label>

            <label>
              Priority
              <select
                value={priority()}
                onChange={(event) => setPriority(event.currentTarget.value as Task["priority"])}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label>
              Repeat
              <select
                value={repeat()}
                onChange={(event) => setRepeat(event.currentTarget.value as "none" | "daily" | "weekly")}
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>

          <section class="inspector-reward" aria-label="Task reward">
            <span>Reward</span>
            <strong>{props.task.value} points</strong>
            <small>Points are set automatically from priority.</small>
          </section>

          <Show
            when={
              isVisibleStreak(props.task.achievement)
                ? props.task.achievement
                : null
            }
          >
            {(achievement) => (
              <section class="inspector-streak">
                <span>Current streak</span>
                <strong>{achievement().name}</strong>
                <progress
                  value={achievement().currentStreak}
                  max={achievement().targetStreak}
                  aria-label={`${achievement().name} streak progress`}
                />
                <small>{achievement().currentStreak} of {achievement().targetStreak}</small>
              </section>
            )}
          </Show>

          <footer class="task-inspector-actions">
            <button type="button" class="danger" onClick={deleteTask}>
              Delete task
            </button>
            <button type="submit" class="primary" disabled={saving() || !title().trim()}>
              {saving() ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </form>
      </Show>
    </aside>
  );
}

export default function Board() {
  const [dragOverColumn, setDragOverColumn] = createSignal<string | null>(null);
  const [selectedChildId, setSelectedChildId] = createSignal("all");
  const [priorityFilter, setPriorityFilter] = createSignal<PriorityFilter>("all");
  const [sortMode, setSortMode] = createSignal<SortMode>("board");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [viewMode, setViewMode] = createSignal<ViewMode>("board");
  const [compactCards, setCompactCards] = createSignal(false);
  const [showStreaks, setShowStreaks] = createSignal(true);
  const [selectedTaskId, setSelectedTaskId] = createSignal<number | null>(null);

  const activeTasks = createMemo(() =>
    store.tasks.filter((task) => task.status !== "archived"),
  );

  const filteredTasks = createMemo(() => {
    const query = searchQuery().trim().toLowerCase();
    const priority = priorityFilter();
    const assignee = selectedChildId();

    const filtered = activeTasks().filter((task) => {
      if (assignee === "unassigned" && task.assigneeId != null) return false;
      if (assignee !== "all" && assignee !== "unassigned" && task.assigneeId !== Number(assignee)) {
        return false;
      }
      if (priority !== "all" && task.priority !== priority) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });

    if (sortMode() === "priority") {
      return [...filtered].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
    }

    if (sortMode() === "assignee") {
      return [...filtered].sort((a, b) =>
        (assigneeName(a.assigneeId) || "Unassigned").localeCompare(
          assigneeName(b.assigneeId) || "Unassigned",
        ),
      );
    }

    return filtered;
  });

  const tasksByStatus = createMemo(() =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        filteredTasks().filter((task) => task.status === column.key),
      ]),
    ) as Record<string, Task[]>,
  );

  const selectedTask = createMemo(() => {
    const id = selectedTaskId();
    return id == null ? undefined : store.tasks.find((task) => task.id === id);
  });

  const clearFilters = () => {
    setSelectedChildId("all");
    setPriorityFilter("all");
    setSortMode("board");
    setSearchQuery("");
  };

  const hasFilters = () =>
    selectedChildId() !== "all" ||
    priorityFilter() !== "all" ||
    sortMode() !== "board" ||
    Boolean(searchQuery().trim());

  return (
    <section class="app-view board-view">
      <header class="board-lead">
        <nav class="project-breadcrumb" aria-label="Breadcrumb">
          <span>Family Task</span>
          <span aria-hidden="true">/</span>
          <strong>Household tasks</strong>
        </nav>

        <div class="board-title-row">
          <span class="project-mark" aria-hidden="true">H</span>
          <div>
            <h1>Household tasks</h1>
            <p>Plan the work, share the load, keep the week moving.</p>
          </div>
          <output class="active-task-count">
            {activeTasks().length} active
          </output>
        </div>

        <nav class="view-tabs" aria-label="Project views">
          <button
            type="button"
            aria-current={viewMode() === "board" ? "page" : undefined}
            onClick={() => setViewMode("board")}
          >
            <span class="view-icon board-icon" aria-hidden="true"><i /><i /><i /></span>
            Board
          </button>
          <button
            type="button"
            aria-current={viewMode() === "list" ? "page" : undefined}
            onClick={() => setViewMode("list")}
          >
            <span class="view-icon list-icon" aria-hidden="true"><i /><i /><i /></span>
            List
          </button>
          <A href="/archived">Archive</A>
        </nav>
      </header>

      <form class="board-toolbar" onSubmit={(event) => event.preventDefault()}>
        <label class="board-search">
          <span class="sr-only">Search tasks</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search this board"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </label>

        <label class="toolbar-select">
          <span>Assignee</span>
          <select value={selectedChildId()} onChange={(event) => setSelectedChildId(event.currentTarget.value)}>
            <option value="all">Everyone</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((user) => user.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </label>

        <label class="toolbar-select">
          <span>Priority</span>
          <select
            value={priorityFilter()}
            onChange={(event) => setPriorityFilter(event.currentTarget.value as PriorityFilter)}
          >
            <option value="all">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label class="toolbar-select">
          <span>Sort</span>
          <select value={sortMode()} onChange={(event) => setSortMode(event.currentTarget.value as SortMode)}>
            <option value="board">Board order</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
          </select>
        </label>

        <details class="view-options">
          <summary>Customize</summary>
          <div>
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={compactCards()}
                onChange={(event) => setCompactCards(event.currentTarget.checked)}
              />
              Compact cards
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={showStreaks()}
                onChange={(event) => setShowStreaks(event.currentTarget.checked)}
              />
              Show streak progress
            </label>
          </div>
        </details>

        <Show when={hasFilters()}>
          <button type="button" class="clear-filters" onClick={clearFilters}>Clear</button>
        </Show>
      </form>

      <div class="board-workspace" data-panel-open={Boolean(selectedTask())}>
        <main class="board-canvas">
          <div class="board-result-line" aria-live="polite">
            <span>
              Showing <strong>{filteredTasks().length}</strong> of {activeTasks().length} active tasks
            </span>
            <Show when={store.activeUser?.type === "parent"}>
              <button type="button" class="quiet-add" onClick={openTaskDialog}>
                <span aria-hidden="true">+</span> Add task
              </button>
            </Show>
          </div>

          <Show
            when={viewMode() === "board"}
            fallback={
              <div class="task-table-wrap">
                <table class="task-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Priority</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For
                      each={filteredTasks()}
                      fallback={
                        <tr>
                          <td colSpan={5} class="table-empty">No tasks match these filters.</td>
                        </tr>
                      }
                    >
                      {(task) => (
                        <tr data-selected={selectedTaskId() === task.id}>
                          <td>
                            <button type="button" class="list-task-open" onClick={() => setSelectedTaskId(task.id)}>
                              <span>Task {task.id}</span>
                              <strong>{task.title}</strong>
                            </button>
                          </td>
                          <td><span class="status-chip" data-status={task.status}>{statusLabel(task.status)}</span></td>
                          <td>
                            <span class="assignee-chip">
                              <i aria-hidden="true">{initials(assigneeName(task.assigneeId))}</i>
                              <span>{assigneeName(task.assigneeId) || "Unassigned"}</span>
                            </span>
                          </td>
                          <td><span class="priority-marker" data-priority={task.priority}>{task.priority}</span></td>
                          <td>{task.value}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            }
          >
            <div class="board-grid" data-compact={compactCards()}>
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
                        if (!Number.isNaN(id)) storeActions.updateTaskStatus(id, column.key);
                      }}
                    >
                      <header class="column-header">
                        <div>
                          <span class="status-dot" aria-hidden="true" />
                          <h2>{column.label}</h2>
                          <output>{tasks().length}</output>
                        </div>
                        <Show when={column.key === "todo" && store.activeUser?.type === "parent"}>
                          <button type="button" class="column-add" aria-label="Add a task" onClick={openTaskDialog}>+</button>
                        </Show>
                      </header>

                      <div class="task-list">
                        <For each={tasks()} fallback={<p class="empty-state">{column.emptyText}</p>}>
                          {(task) => (
                            <TaskCard
                              task={task}
                              column={column}
                              compact={compactCards()}
                              showStreaks={showStreaks()}
                              selected={selectedTaskId() === task.id}
                              onOpen={() => setSelectedTaskId(task.id)}
                            />
                          )}
                        </For>
                      </div>
                    </section>
                  );
                }}
              </For>
            </div>
          </Show>
        </main>

        <Show when={selectedTask()}>
          {(task) => <TaskInspector task={task()} onClose={() => setSelectedTaskId(null)} />}
        </Show>
      </div>
    </section>
  );
}
