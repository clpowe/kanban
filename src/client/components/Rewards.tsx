import { For, Show } from "solid-js";
import { store, storeActions } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";

export default function Rewards() {
  const isParent = () => store.activeUser?.type === "parent";
  const sortedUsers = () =>
    [...store.users]
      .filter((user) => user.type === "child")
      .sort((a, b) => b.points - a.points);

  return (
    <section class="app-view rewards-view">
      <header class="page-lead">
        <div>
          <h1>Points and rewards</h1>
          <p>See everyone’s points and choose what to work toward next.</p>
        </div>
      </header>

      <div class="rewards-grid">
        <section class="leaderboard">
          <header>
            <h2>Family leaderboard</h2>
            <p>Current points across the household.</p>
          </header>

          <ol>
            <For
              each={sortedUsers()}
              fallback={<li class="empty-row">No child accounts yet.</li>}
            >
              {(user, index) => (
                <li>
                  <span>{index() + 1}</span>
                  <strong>{user.name}</strong>
                  <output><AnimatedPoints value={user.points} /> pts</output>
                </li>
              )}
            </For>
          </ol>
        </section>

        <section class="reward-shelf">
          <header>
            <h2>Reward shelf</h2>
            <p>Spend earned points on a family reward.</p>
          </header>

          <ul>
            <For
              each={store.rewards}
              fallback={<li class="empty-row">No rewards configured yet.</li>}
            >
              {(reward) => {
                const points = () => store.activeUser?.points || 0;
                const canAfford = () => points() >= reward.cost;

                return (
                  <li>
                    <p>
                      <strong>{reward.title}</strong>
                      <span>{reward.cost} pts</span>
                    </p>

                    <Show
                      when={isParent()}
                      fallback={
                        <button
                          type="button"
                          class="primary"
                          disabled={!canAfford()}
                          title={
                            canAfford()
                              ? `Redeem ${reward.title}`
                              : `Need ${reward.cost - points()} more points`
                          }
                          onClick={() => storeActions.redeemReward(reward.id)}
                        >
                          {canAfford() ? "Redeem" : `Need ${reward.cost - points()} more`}
                        </button>
                      }
                    >
                      <output>{reward.cost} pts</output>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </section>
      </div>
    </section>
  );
}
