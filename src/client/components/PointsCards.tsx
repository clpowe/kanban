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
      <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md shadow-xl flex flex-col gap-4 group">
        {/* Top Row: User details & points balance */}
        <div class="flex items-center justify-between gap-6">
          <div class="relative z-10">
            <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
              Active Member
            </p>
            <h2 class="text-4xl font-black mt-1 text-slate-100 flex items-center gap-2.5">
              <Show when={store.activeUser!.image}>
                <span class="text-3xl select-none animate-bounce">
                  {store.activeUser!.image}
                </span>
              </Show>
              {store.activeUser!.name}
            </h2>
          </div>
          {/* Right: Smooth Ticking Points Balance */}
          <div class="relative z-10 text-right">
            <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
              Accumulated Balance
            </p>
            <h2 class="text-3xl font-black mt-1 text-slate-100 flex items-center justify-end gap-1.5">
              ⭐ <AnimatedPoints value={store.activeUser!.points} />
            </h2>
          </div>
        </div>

        {/* Bottom Row: Active Streaks */}
        <Show when={activeStreaks().length > 0}>
          <div class="border-t border-slate-800/80 pt-4 flex flex-col gap-2 relative z-10">
            <p class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              ⚡ Active Streaks
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
                    <div class="flex items-center gap-2 bg-slate-950/40 border border-slate-850 rounded-2xl px-3 py-1.5 text-xs text-slate-350 shadow-inner group/streak hover:border-slate-800 hover:text-slate-200 transition-all duration-200">
                      <span class="text-slate-400 font-medium select-none">
                        {lvl().icon}
                      </span>
                      <span class="font-bold flex items-center gap-1">
                        {ach.name}
                        <Show when={ach.prestigeCount > 0}>
                          <span
                            class="text-amber-400 font-extrabold flex items-center animate-pulse"
                            title={`Prestige ${ach.prestigeCount}x`}
                          >
                            ⭐{ach.prestigeCount > 1 ? ` ${ach.prestigeCount}` : ""}
                          </span>
                        </Show>
                      </span>
                      <span class="text-slate-800 font-semibold select-none">|</span>
                      <span class="text-indigo-400 font-black tracking-wide whitespace-nowrap">
                        ⚡ {ach.currentStreak}/{ach.targetStreak}
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
