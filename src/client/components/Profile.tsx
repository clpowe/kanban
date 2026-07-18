import {
  createResource,
  createSignal,
  For,
  Show,
  createEffect,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { api } from "../lib/api";
import { getStreakLevel } from "./Board";

// Available Avatars Config
const avatars = [
  { emoji: "🦊", name: "Friendly Fox", req: 0 },
  { emoji: "🐼", name: "Playful Panda", req: 15 },
  { emoji: "🐨", name: "Kind Koala", req: 30 },
  { emoji: "🐯", name: "Tiny Tiger", req: 50 },
  { emoji: "🦁", name: "Loyal Lion", req: 75 },
  { emoji: "🐲", name: "Dreamy Dragon", req: 100 },
];

export default function Profile() {
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = createSignal<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = createSignal(false);
  const [avatarLoading, setAvatarLoading] = createSignal(false);

  // Auth Guard: Only children can customize profiles/avatars
  createEffect(() => {
    if (store.activeUser && store.activeUser.type !== "child") {
      navigate("/", { replace: true });
    }
  });

  // Resource to pull achievements, badges, and stats from backend
  const [achievementsData, { refetch }] = createResource(
    () => store.activeUser?.id,
    async (userId) => {
      if (!userId) return null;
      return await api.getUserAchievements(userId);
    },
  );

  const handleSelectAvatar = async (emoji: string) => {
    if (!store.activeUser) return;
    setAvatarError(null);
    setAvatarSuccess(false);

    const totalCompleted = achievementsData()?.stats?.totalCompleted || 0;
    const req = avatars.find((av) => av.emoji === emoji)?.req || 0;

    if (totalCompleted < req) {
      setAvatarError(`Complete ${req} tasks to unlock this avatar!`);
      return;
    }

    setAvatarLoading(true);
    try {
      const res = await storeActions.updateUserAvatar(
        store.activeUser.id,
        emoji,
      );
      if (res?.success) {
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 2500);
      }
    } catch (err: any) {
      setAvatarError(err?.message || "Failed to update avatar");
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div class="app-view profile-view flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div class="flex flex-col gap-1.5 p-1">
        <h2 class="text-3xl font-black text-slate-100 tracking-tight">
          Profile and badges
        </h2>
        <p class="text-sm text-slate-400 max-w-xl">
          Customize your profile avatar by completing tasks and track your
          repeating streak achievements.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Stats & Avatars */}
        <div class="lg:col-span-2 flex flex-col gap-6">
          {/* Custom Avatars section */}
          <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
            <div>
              <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
                Choose your avatar
              </h3>
              <p class="text-xs text-slate-400 mt-1">
                Unlock cute animal avatars as you complete chores. Click an
                unlocked avatar to set it.
              </p>
            </div>

            <Show when={avatarSuccess()}>
              <div class="rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-2.5">
                <p class="text-xs font-semibold text-teal-400">
                  Avatar updated.
                </p>
              </div>
            </Show>
            <Show when={avatarError()}>
              <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
                <p class="text-xs font-semibold text-rose-400">
                  {avatarError()}
                </p>
              </div>
            </Show>

            {/* Avatar Grid */}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <For each={avatars}>
                {(av) => {
                  const totalCompleted = () =>
                    achievementsData()?.stats?.totalCompleted || 0;
                  const isUnlocked = () => totalCompleted() >= av.req;
                  const isActive = () => store.activeUser?.image === av.emoji;

                  return (
                    <button
                      onClick={() => handleSelectAvatar(av.emoji)}
                      disabled={avatarLoading()}
                      class={`avatar-choice relative rounded-2xl border p-4 flex flex-col items-center gap-2 cursor-pointer ${
                        isActive()
                          ? "border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/5 ring-1 ring-amber-400/30"
                          : isUnlocked()
                            ? "border-slate-850 bg-slate-950/20 hover:bg-slate-950/40"
                            : "border-slate-900 bg-slate-950/50 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <span class="text-4xl select-none">{av.emoji}</span>
                      <div class="text-center">
                        <p class="text-xs font-bold text-slate-200">
                          {av.name}
                        </p>
                        <p class="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                          {isUnlocked() ? "Unlocked" : `Req: ${av.req} Tasks`}
                        </p>
                      </div>
                      <Show when={!isUnlocked()}>
                        <div
                          class="absolute top-2 right-2 text-xs"
                          title="Locked"
                        >
                          Locked
                        </div>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </section>

          {/* Trophy Room Section */}
          <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
            <div>
              <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
                Trophy room
              </h3>
              <p class="text-xs text-slate-400 mt-1">
                Your collection of permanent badges earned from completed streak
                milestones.
              </p>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <For
                each={achievementsData()?.badges}
                fallback={
                  <div class="col-span-full rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 italic">
                    No badges earned yet. Complete a streak milestone to earn
                    your first medal!
                  </div>
                }
              >
                {(badge) => (
                  <div class="trophy-card rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 flex flex-col items-center gap-2.5 relative overflow-hidden group">
                    <div class="relative h-16 w-16 rounded-full bg-slate-900 border border-amber-400/40 shadow-inner flex items-center justify-center">
                      <span class="text-xl font-black select-none">L</span>
                      <span class="absolute -bottom-1 -right-1 text-[10px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full border border-slate-950">
                        x{badge.prestigeLevel}
                      </span>
                    </div>

                    <div class="text-center">
                      <p class="text-xs font-black text-amber-300">
                        {badge.badgeName}
                      </p>
                      <p class="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                        Earned: {new Date(badge.earnedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>

        {/* Right Column: Achievements & Stats Summary */}
        <div class="flex flex-col gap-6">
          {/* Stats Card */}
          <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Your numbers
            </h3>
            <div class="grid grid-cols-2 gap-3 mt-1">
              <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-center">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Completions
                </span>
                <p class="text-2xl font-black text-slate-200 mt-0.5">
                  {achievementsData()?.stats?.totalCompleted || 0}
                </p>
              </div>
              <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-center">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  High Priority
                </span>
                <p class="text-2xl font-black text-rose-400 mt-0.5">
                  {achievementsData()?.stats?.highPriorityCompleted || 0}
                </p>
              </div>
              <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-center">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Repeating
                </span>
                <p class="text-2xl font-black text-indigo-400 mt-0.5">
                  {achievementsData()?.stats?.repeatingCompleted || 0}
                </p>
              </div>
              <div class="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-center">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Clean Up Chores
                </span>
                <p class="text-2xl font-black text-emerald-400 mt-0.5">
                  {achievementsData()?.stats?.cleanCompleted || 0}
                </p>
              </div>
            </div>
          </section>

          {/* Active Streaks Column */}
          <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
            <div>
              <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
                Active task streaks
              </h3>
              <p class="text-xs text-slate-400 mt-1">
                Your active repeating streaks. Maintain completions to upgrade
                your medal level!
              </p>
            </div>

            <div class="flex flex-col gap-4 mt-2">
              <For
                each={achievementsData()?.achievements}
                fallback={
                  <div class="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 italic">
                    No active repeating achievements.
                  </div>
                }
              >
                {(ach) => {
                  const lvl = () =>
                    getStreakLevel(
                      ach.currentStreak,
                      ach.targetStreak,
                      ach.prestigeCount,
                    );
                  const pct = () =>
                    Math.min(
                      100,
                      Math.round((ach.currentStreak / ach.targetStreak) * 100),
                    );

                  return (
                    <div class="rounded-2xl border border-slate-850 bg-slate-950/20 p-4 flex flex-col gap-2 relative overflow-hidden group">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <p class="font-black text-slate-100 text-sm">
                            {ach.name}
                          </p>
                          <p class="text-[10px] text-slate-500 mt-0.5">
                            Task: {ach.taskTitle} ({ach.taskRepeat})
                          </p>
                        </div>
                        <span
                          class={`badge text-[10px] font-bold uppercase tracking-wider py-2.5 px-2 rounded-lg border ${lvl().color}`}
                        >
                          {lvl().icon} {lvl().name}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div class="flex flex-col gap-1 mt-1">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-slate-400 font-bold">Streak</span>
                          <span class="text-slate-400 font-bold">
                            {ach.currentStreak} / {ach.targetStreak}
                          </span>
                        </div>
                        <div class="w-full bg-slate-950 border border-slate-900 rounded-full h-2 overflow-hidden">
                          <div
                            class="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${pct()}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
