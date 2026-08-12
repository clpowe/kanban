import { For, Show, createEffect, createResource, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { api } from "../lib/api";
import { getStreakLevel } from "./Board";
import { isVisibleStreak } from "../lib/streak-visibility";

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

  createEffect(() => {
    if (store.activeUser && store.activeUser.type !== "child") {
      navigate("/", { replace: true });
    }
  });

  const [achievementsData] = createResource(
    () => store.activeUser?.id,
    async (userId) => (userId ? api.getUserAchievements(userId) : null),
  );

  const handleSelectAvatar = async (emoji: string) => {
    if (!store.activeUser) return;
    setAvatarError(null);
    setAvatarSuccess(false);

    const totalCompleted = achievementsData()?.stats?.totalCompleted || 0;
    const requirement = avatars.find((avatar) => avatar.emoji === emoji)?.req || 0;

    if (totalCompleted < requirement) {
      setAvatarError(`Complete ${requirement} tasks before choosing this avatar.`);
      return;
    }

    setAvatarLoading(true);
    try {
      const result = await storeActions.updateUserAvatar(store.activeUser.id, emoji);
      if (result?.success) {
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 2500);
      }
    } catch (error: any) {
      setAvatarError(error?.message || "The avatar did not update. Try again.");
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <section class="app-view profile-view">
      <header class="page-lead">
        <div>
          <h1>Profile and badges</h1>
          <p>Choose an avatar and follow your completed tasks and streaks.</p>
        </div>
      </header>

      <div class="profile-bento">
        <section class="avatar-panel">
          <header>
            <h2>Choose your avatar</h2>
            <p>Complete more tasks to unlock more animals.</p>
          </header>

          <Show when={avatarSuccess()}>
            <p class="form-status" data-state="success" role="status">Avatar updated.</p>
          </Show>
          <Show when={avatarError()}>
            <p class="form-status" data-state="error" role="alert">{avatarError()}</p>
          </Show>

          <div class="avatar-grid">
            <For each={avatars}>
              {(avatar) => {
                const completed = () => achievementsData()?.stats?.totalCompleted || 0;
                const unlocked = () => completed() >= avatar.req;
                const active = () => store.activeUser?.image === avatar.emoji;

                return (
                  <button
                    type="button"
                    class="avatar-choice"
                    data-active={active()}
                    data-locked={!unlocked()}
                    disabled={avatarLoading()}
                    aria-pressed={active()}
                    onClick={() => handleSelectAvatar(avatar.emoji)}
                  >
                    <span aria-hidden="true">{avatar.emoji}</span>
                    <strong>{avatar.name}</strong>
                    <small>{unlocked() ? "Unlocked" : `${avatar.req} tasks`}</small>
                  </button>
                );
              }}
            </For>
          </div>
        </section>

        <section class="profile-stats">
          <h2>Your numbers</h2>
          <dl>
            <div>
              <dt>Completions</dt>
              <dd>{achievementsData()?.stats?.totalCompleted || 0}</dd>
            </div>
            <div>
              <dt>High priority</dt>
              <dd>{achievementsData()?.stats?.highPriorityCompleted || 0}</dd>
            </div>
            <div>
              <dt>Repeating</dt>
              <dd>{achievementsData()?.stats?.repeatingCompleted || 0}</dd>
            </div>
            <div>
              <dt>Clean-up chores</dt>
              <dd>{achievementsData()?.stats?.cleanCompleted || 0}</dd>
            </div>
          </dl>
        </section>

        <section class="trophy-panel">
          <header>
            <h2>Trophy room</h2>
            <p>Permanent badges from completed streak milestones.</p>
          </header>

          <div class="trophy-grid">
            <For
              each={achievementsData()?.badges}
              fallback={<p class="empty-row">No badges yet. Complete a streak milestone to earn one.</p>}
            >
              {(badge) => (
                <article>
                  <strong aria-hidden="true">L{badge.prestigeLevel}</strong>
                  <h3>{badge.badgeName}</h3>
                  <time datetime={new Date(badge.earnedAt).toISOString()}>
                    {new Date(badge.earnedAt).toLocaleDateString()}
                  </time>
                </article>
              )}
            </For>
          </div>
        </section>

        <section class="streak-panel">
          <header>
            <h2>Active streaks</h2>
            <p>Repeat the task to move its medal forward.</p>
          </header>

          <div class="streak-list">
            <For
              each={achievementsData()?.achievements.filter(isVisibleStreak)}
              fallback={<p class="empty-row">No active repeating achievements.</p>}
            >
              {(achievement) => {
                const level = () =>
                  getStreakLevel(
                    achievement.currentStreak,
                    achievement.targetStreak,
                    achievement.prestigeCount,
                  );

                return (
                  <article data-tone={level().tone}>
                    <header>
                      <h3>{achievement.name}</h3>
                      <span>{level().icon} · {level().name}</span>
                    </header>
                    <p>{achievement.taskTitle} · {achievement.taskRepeat}</p>
                    <progress
                      value={achievement.currentStreak}
                      max={achievement.targetStreak}
                      aria-label={`${achievement.name} streak progress`}
                    />
                    <small>{achievement.currentStreak} of {achievement.targetStreak}</small>
                  </article>
                );
              }}
            </For>
          </div>
        </section>
      </div>
    </section>
  );
}
