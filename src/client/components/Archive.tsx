import { For, Show, createMemo, createSignal } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { Task } from "../../types";

export default function Archive() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedAssignee, setSelectedAssignee] = createSignal("all");
  const [selectedPriority, setSelectedPriority] = createSignal("all");

  const archivedTasks = createMemo(() =>
    store.tasks.filter((task) => task.status === "archived"),
  );

  const filteredTasks = createMemo(() =>
    archivedTasks().filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery().toLowerCase());
      const matchesAssignee =
        selectedAssignee() === "all" ||
        (selectedAssignee() === "unassigned" && task.assigneeId == null) ||
        task.assigneeId?.toString() === selectedAssignee();
      const matchesPriority =
        selectedPriority() === "all" || task.priority === selectedPriority();
      return matchesSearch && matchesAssignee && matchesPriority;
    }),
  );

  const assigneeName = (id: number | null | undefined) => {
    if (id == null) return "Unassigned";
    return store.users.find((user) => user.id === id)?.name || "Unknown";
  };

  const isRolloverArchive = (task: Task) =>
    task.repeat &&
    task.repeat !== "none" &&
    (task.archiveReason === "completed" || task.archiveReason === "missed");

  const deleteTask = (task: Task) => {
    const confirmed = window.confirm(
      `Permanently delete “${task.title}”? This cannot be undone.`,
    );
    if (confirmed) storeActions.deleteTask(task.id);
  };

  return (
    <section class="app-view archive-view">
      <header class="page-lead">
        <div>
          <h1>Task archive</h1>
          <p>Find finished work, restore a task, or clear old history.</p>
        </div>
        <output>{archivedTasks().length} total</output>
      </header>

      <form class="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search tasks
          <input
            type="search"
            placeholder="Laundry"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </label>
        <label>
          Assignee
          <select value={selectedAssignee()} onChange={(event) => setSelectedAssignee(event.currentTarget.value)}>
            <option value="all">All members</option>
            <option value="unassigned">Unassigned</option>
            <For each={store.users.filter((user) => user.type === "child")}>
              {(user) => <option value={user.id}>{user.name}</option>}
            </For>
          </select>
        </label>
        <label>
          Priority
          <select value={selectedPriority()} onChange={(event) => setSelectedPriority(event.currentTarget.value)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </form>

      <Show
        when={archivedTasks().length > 0}
        fallback={
          <section class="empty-state">
            <h2>Archive is empty</h2>
            <p>Completed recurring tasks and archived work will appear here.</p>
          </section>
        }
      >
        <Show
          when={filteredTasks().length > 0}
          fallback={
            <section class="empty-state">
              <h2>No matching tasks</h2>
              <p>Change the search or filters to see more history.</p>
            </section>
          }
        >
          <div class="archive-grid">
            <For each={filteredTasks()}>
              {(task) => (
                <article class="archive-card" data-priority={task.priority}>
                  <header>
                    <span>{task.priority}</span>
                    <strong>{task.value} pts</strong>
                  </header>
                  <h2>{task.title}</h2>
                  <Show when={task.archiveReason}>
                    <p class="archive-reason" data-reason={task.archiveReason}>
                      {task.archiveReason}
                    </p>
                  </Show>
                  <footer>
                    <span>{assigneeName(task.assigneeId)}</span>
                    <div class="button-row">
                      <button
                        type="button"
                        onClick={() => storeActions.updateTaskStatus(task.id, "todo")}
                        disabled={Boolean(isRolloverArchive(task))}
                        title={
                          isRolloverArchive(task)
                            ? "Recurring history cannot be restored"
                            : "Restore to the active board"
                        }
                      >
                        Restore
                      </button>
                      <button type="button" class="danger" onClick={() => deleteTask(task)}>
                        Delete
                      </button>
                    </div>
                  </footer>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  );
}
