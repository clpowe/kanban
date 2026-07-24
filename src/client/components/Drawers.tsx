import { For, Show, createSignal } from "solid-js";
import type { ParentProps } from "solid-js";
import { store, storeActions } from "../store/app-store";
import type { CreateTask } from "../../types";

export default function AppShell(props: ParentProps) {
  const [taskTitle, setTaskTitle] = createSignal("");
  const [taskPriority, setTaskPriority] = createSignal<"low" | "medium" | "high">("medium");
  const [taskRepeat, setTaskRepeat] = createSignal<"none" | "daily" | "weekly">("none");
  const [taskAssigneeId, setTaskAssigneeId] = createSignal("");
  const [attachAchievement, setAttachAchievement] = createSignal(false);
  const [achievementName, setAchievementName] = createSignal("");
  const [targetStreak, setTargetStreak] = createSignal(20);
  const [saving, setSaving] = createSignal(false);

  const closeTaskDialog = () => {
    const dialog = document.getElementById("task-dialog") as HTMLDialogElement | null;
    dialog?.close();
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskPriority("medium");
    setTaskRepeat("none");
    setTaskAssigneeId("");
    setAttachAchievement(false);
    setAchievementName("");
    setTargetStreak(20);
  };

  const handleAddTask = async (event: Event) => {
    event.preventDefault();
    if (!taskTitle().trim()) return;

    const assigneeId = taskAssigneeId() === "" ? null : Number(taskAssigneeId());
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

    setSaving(true);
    try {
      const result = await storeActions.addTask(newTask);
      if (result) {
        resetTaskForm();
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
              <h2>Add a task</h2>
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
              <button type="submit" class="primary" disabled={saving()} aria-busy={saving()}>
                {saving() ? "Adding…" : "Add task"}
              </button>
            </div>
          </form>
        </dialog>
      </Show>
    </div>
  );
}
