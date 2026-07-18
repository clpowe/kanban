import { Show, For } from "solid-js";
import { store, storeActions } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";

export default function Rewards() {
  const isParent = () => store.activeUser?.type === "parent";

  const handleRedeem = async (id: number) => {
    await storeActions.redeemReward(id);
  };

  // Sort users for the leaderboard (highest points first)
  const sortedUsers = () => {
    return [...store.users]
      .filter((u) => u.type === "child")
      .sort((a, b) => b.points - a.points);
  };

  return (
    <div class="app-view rewards-view flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div class="flex flex-col gap-1.5 p-1">
        <h2 class="text-3xl font-black text-slate-100 tracking-tight">
          Points and rewards
        </h2>
        <p class="text-sm text-slate-400 max-w-xl">
          See everyone’s points and choose what to work toward next.
        </p>
      </div>

      {/* Main Content Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Section 1: Leaderboard */}
        <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Family leaderboard
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Current points across the household.
            </p>
          </div>

          <div class="rounded-xl bg-slate-950/20 border border-slate-800/80 p-4">
            <ul class="divide-y divide-slate-800/60">
              <For
                each={sortedUsers()}
                fallback={
                  <li class="py-4 text-center text-xs text-slate-500 italic">
                    No child accounts registered yet.
                  </li>
                }
              >
                {(u) => (
                  <li class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-slate-200">
                        {u.name}
                      </span>
                      <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {u.type}
                      </span>
                    </div>
                    <span class="badge font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3.5 py-3 rounded-lg">
                      <AnimatedPoints value={u.points} /> pts
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </section>

        {/* Section 2: Rewards Center */}
        <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Reward shelf
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Spend earned points on a family reward.
            </p>
          </div>

          <ul class="flex flex-col gap-3">
            <For
              each={store.rewards}
              fallback={
                <li class="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 italic">
                  No rewards configured yet.
                </li>
              }
            >
              {(reward) => {
                const activeUserPoints = () => store.activeUser?.points || 0;
                const canAfford = () => activeUserPoints() >= reward.cost;
                const shortfall = () => reward.cost - activeUserPoints();
                return (
                  <li class="reward-row flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/20">
                    <div class="min-w-0">
                      <p class="font-bold text-sm text-slate-200 truncate">
                        {reward.title}
                      </p>
                      <p class="text-xs font-semibold text-slate-400 mt-0.5">
                        {reward.cost} pts
                      </p>
                    </div>
                    <Show
                      when={isParent()}
                      fallback={
                        <Show
                          when={canAfford()}
                          fallback={
                            <div class="flex flex-col items-end gap-1">
                              <button
                                class="btn btn-xs rounded-lg bg-slate-850 text-slate-500 cursor-not-allowed border-0"
                                disabled
                              >
                                Redeem
                              </button>
                              <span class="text-[10px] font-bold text-rose-400">
                                Need {shortfall()} more
                              </span>
                            </div>
                          }
                        >
                          <button
                            onClick={() => handleRedeem(reward.id)}
                            class="btn btn-xs rounded-lg font-bold border-0 bg-teal-400 hover:bg-teal-300 text-slate-950"
                          >
                            Redeem
                          </button>
                        </Show>
                      }
                    >
                      <span class="badge text-xs font-semibold bg-slate-800 text-slate-300 border-0 rounded-lg">
                        {reward.cost} pts
                      </span>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </section>
      </div>
    </div>
  );
}
