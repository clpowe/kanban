import { Show, For, createMemo } from "solid-js";
import { store } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";
import { getStreakLevel } from "./Board";

export default function PointCards() {
  const activeStreaks = createMemo(() => {
    if (!store.activeUser) return [];
    return store.tasks.filter(
      (t) =>
        t.assigneeId === store.activeUser!.id &&
        (t.repeat === "daily" || t.repeat === "weekly") &&
        t.status !== "archived" &&
        t.achievement
    );
  });

  return (
    <Show when={store.activeUser && store.activeUser.type !== "parent"}>
      <div class="points-panel relative overflow-hidden rounded-3xl border border-slate-800 p-6 flex flex-col gap-4 group">
        {/* Top Row: User details & points balance */}
        <div class="flex items-center justify-between gap-6">
          <div class="relative z-10">
            <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
              Playing as
            </p>
            <h2 class="text-4xl font-black mt-1 text-slate-100 flex items-center gap-2.5">
              <Show when={store.activeUser!.image}>
                <span class="text-3xl select-none">
                  {store.activeUser!.image}
                </span>
              </Show>
              {store.activeUser!.name}
            </h2>
          </div>
          {/* Right: Smooth Ticking Points Balance */}
          <div class="relative z-10 text-right">
            <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
              Points ready
            </p>
            <h2 class="text-3xl font-black mt-1 text-slate-100 flex items-center justify-end gap-1.5">
              <AnimatedPoints value={store.activeUser!.points} /> pts
            </h2>
          </div>
        </div>

        {/* Bottom Row: Active Streaks */}
        <Show when={activeStreaks().length > 0}>
          <div class="border-t border-slate-800/80 pt-4 flex flex-col gap-2 relative z-10">
            <p class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Active streaks
            </p>
            <div class="flex flex-wrap gap-2.5 mt-0.5">
              <For each={activeStreaks()}>
                {(task) => {
                  const ach = task.achievement!;
                  const lvl = () =>
                    getStreakLevel(
                      ach.currentStreak,
                      ach.targetStreak,
                      ach.prestigeCount,
                    );
                  return (
                    <div class="streak-chip flex items-center gap-2 bg-slate-950/40 border border-slate-850 rounded-2xl px-3 py-2 text-xs text-slate-350 group/streak">
                      <span class="rank-chip text-slate-400 font-medium select-none">
                        {lvl().icon}
                      </span>
                      <span class="font-bold flex items-center gap-1">
                        {ach.name}
                        <Show when={ach.prestigeCount > 0}>
                          <span
                            class="text-amber-400 font-extrabold flex items-center"
                            title={`Prestige ${ach.prestigeCount}x`}
                          >
                            {ach.prestigeCount}×
                          </span>
                        </Show>
                      </span>
                      <span class="text-slate-800 font-semibold select-none">|</span>
                      <span class="text-indigo-400 font-black tracking-wide whitespace-nowrap">
                        {ach.currentStreak}/{ach.targetStreak}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
