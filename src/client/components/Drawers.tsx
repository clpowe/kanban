import { For, Show, createSignal, onSettled } from "solid-js";
import type { ParentProps } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { CreateTask, Task } from "../../types";

export default function AppShell(props: ParentProps) {
  const [taskTitle, setTaskTitle] = createSignal("");
  const [taskPriority, setTaskPriority] = createSignal<"low" | "medium" | "high">("medium");
  const [taskRepeat, setTaskRepeat] = createSignal<"none" | "daily" | "weekly">("none");
  const [taskAssigneeId, setTaskAssigneeId] = createSignal("");
  const [attachAchievement, setAttachAchievement] = createSignal(false);
  const [achievementName, setAchievementName] = createSignal("");
  const [targetStreak, setTargetStreak] = createSignal(20);
  const [saving, setSaving] = createSignal(false);
  const [editingTaskId, setEditingTaskId] = createSignal<number | null>(null);

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskPriority("medium");
    setTaskRepeat("none");
    setTaskAssigneeId("");
    setAttachAchievement(false);
    setAchievementName("");
    setTargetStreak(20);
    setEditingTaskId(null);
  };

  const closeTaskDialog = () => {
    const dialog = document.getElementById("task-dialog") as HTMLDialogElement | null;
    dialog?.close();
    resetTaskForm();
  };

  const populateTaskForm = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskPriority(task.priority);
    setTaskRepeat(task.repeat ?? "none");
    setTaskAssigneeId(task.assigneeId == null ? "" : String(task.assigneeId));
    setAttachAchievement(task.achievement?.streakEnabled === true);
    setAchievementName(task.achievement?.name ?? "");
    setTargetStreak(task.achievement?.targetStreak ?? 20);
  };

  onSettled(() => {
    const handleEditTask = (event: Event) => {
      const taskId = (event as CustomEvent<number>).detail;
      const task = store.tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.status === "archived") return;

      populateTaskForm(task);
      const dialog = document.getElementById("task-dialog") as HTMLDialogElement | null;
      if (dialog && !dialog.open) dialog.showModal();
    };

    window.addEventListener("family-task:edit-task", handleEditTask);
    return () =>
      window.removeEventListener("family-task:edit-task", handleEditTask);
  });

  const handleAddTask = async (event: Event) => {
    event.preventDefault();
    if (!taskTitle().trim()) return;

    const assigneeId = taskAssigneeId() === "" ? null : Number(taskAssigneeId());
    const newTask: CreateTask = {
      title: taskTitle().trim(),
      priority: taskPriority(),
      repeat: taskRepeat(),
      assigneeId,
      streakEnabled: attachAchievement(),
    };

    if (
      attachAchievement() &&
      achievementName().trim() &&
      (taskRepeat() === "daily" || taskRepeat() === "weekly")
    ) {
      newTask.achievementName = achievementName().trim();
      newTask.targetStreak = Number(targetStreak());
    }

    setSaving(true);
    try {
      const result =
        editingTaskId() == null
          ? await storeActions.addTask(newTask)
          : await storeActions.updateTask(editingTaskId()!, newTask);
      if (result) {
        closeTaskDialog();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="app-shell">
      <div class="app-main">{props.children}</div>

      <footer class="app-footer">
        <p>Pick a task · Do the thing · Help the house.</p>
      </footer>

      <Show when={store.activeUser?.type === "parent"}>
        <dialog
          id="task-dialog"
          class="task-dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeTaskDialog();
          }}
        >
          <header>
            <div>
              <span>Household board</span>
              <h2>{editingTaskId() == null ? "Add a task" : "Edit task"}</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Close task form" onClick={closeTaskDialog}>
              ×
            </button>
          </header>

          <form onSubmit={handleAddTask}>
            <label>
              Task name
              <input
                id="new-task-title"
                type="text"
                placeholder="Vacuum the living room"
                value={taskTitle()}
                onInput={(event) => setTaskTitle(event.currentTarget.value)}
                required
                autofocus
              />
            </label>

            <div class="field-row">
              <label>
                Priority
                <select
                  value={taskPriority()}
                  onChange={(event) => setTaskPriority(event.currentTarget.value as "low" | "medium" | "high")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label>
                Repeat
                <select
                  value={taskRepeat()}
                  onChange={(event) => setTaskRepeat(event.currentTarget.value as "none" | "daily" | "weekly")}
                >
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            </div>

            <label>
              Assignee
              <select value={taskAssigneeId()} onChange={(event) => setTaskAssigneeId(event.currentTarget.value)}>
                <option value="">Unassigned</option>
                <For each={store.users.filter((user) => user.type === "child")}>
                  {(user) => <option value={user.id}>{user.name}</option>}
                </For>
              </select>
            </label>

            <Show when={taskRepeat() !== "none"}>
              <fieldset class="achievement-fields">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={attachAchievement()}
                    onChange={(event) => setAttachAchievement(event.currentTarget.checked)}
                  />
                  Track this as a streak
                </label>

                <Show when={attachAchievement()}>
                  <label>
                    Streak name
                    <input
                      type="text"
                      placeholder="Room cleaning"
                      value={achievementName()}
                      onInput={(event) => setAchievementName(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label>
                    Target {taskRepeat() === "daily" ? "days" : "weeks"}
                    <input
                      type="number"
                      min="1"
                      value={targetStreak()}
                      onInput={(event) => setTargetStreak(Number(event.currentTarget.value))}
                      required
                    />
                  </label>
                </Show>
              </fieldset>
            </Show>

            <div class="dialog-actions">
              <button type="button" onClick={closeTaskDialog}>
                Cancel
              </button>
              <button type="submit" class="primary" disabled={saving()} aria-busy={saving() ? "true" : "false"}>
                {saving()
                  ? editingTaskId() == null
                    ? "Adding…"
                    : "Saving…"
                  : editingTaskId() == null
                    ? "Add task"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </dialog>
      </Show>
    </div>
  );
}
