import { For, Show, createMemo } from "solid-js";
import { store } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";
import { getStreakLevel } from "./Board";

export default function PointCards() {
  const activeStreaks = createMemo(() => {
    if (!store.activeUser) return [];
    return store.tasks.filter(
      (task) =>
        task.assigneeId === store.activeUser!.id &&
        (task.repeat === "daily" || task.repeat === "weekly") &&
        task.status !== "archived" &&
        task.achievement,
    );
  });

  return (
    <Show when={store.activeUser?.type === "child"}>
      <aside class="points-panel" aria-label="Active player summary">
        <p class="player-name">
          <Show when={store.activeUser?.image}>
            <span aria-hidden="true">{store.activeUser?.image}</span>
          </Show>
          Playing as <strong>{store.activeUser?.name}</strong>
        </p>

        <p class="point-balance">
          <strong><AnimatedPoints value={store.activeUser?.points || 0} /></strong>
          points ready
        </p>

        <Show when={activeStreaks().length > 0}>
          <ul aria-label="Active streaks">
            <For each={activeStreaks()}>
              {(task) => {
                const achievement = task.achievement!;
                const level = () =>
                  getStreakLevel(
                    achievement.currentStreak,
                    achievement.targetStreak,
                    achievement.prestigeCount,
                  );

                return (
                  <li data-tone={level().tone}>
                    <strong>{achievement.name}</strong>
                    <span>{achievement.currentStreak}/{achievement.targetStreak}</span>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </aside>
    </Show>
  );
}
