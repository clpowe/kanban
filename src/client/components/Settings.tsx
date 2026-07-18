import { Show, createSignal, createEffect, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";

export default function Settings() {
  const navigate = useNavigate();

  // Guard: Redirect non-parent users back to the board
  createEffect(() => {
    if (store.activeUser && store.activeUser.type !== "parent") {
      navigate("/", { replace: true });
    }
  });

  // ── Form States for Adding a Reward ───────────────────
  const [rewardTitle, setRewardTitle] = createSignal("");
  const [rewardCost, setRewardCost] = createSignal<number>(10);
  const [rewardSuccess, setRewardSuccess] = createSignal(false);
  const [rewardError, setRewardError] = createSignal<string | null>(null);

  // ── Form States for Adding a Child ────────────────────
  const [childName, setChildName] = createSignal("");
  const [childUsername, setChildUsername] = createSignal("");
  const [childEmail, setChildEmail] = createSignal("");
  const [childPassword, setChildPassword] = createSignal("");
  const [childError, setChildError] = createSignal<string | null>(null);
  const [childSuccess, setChildSuccess] = createSignal(false);
  const [childLoading, setChildLoading] = createSignal(false);

  // ── Form States for Changing a Child's Password ───────
  const [targetChildId, setTargetChildId] = createSignal<number | "">("");
  const [newPassword, setNewPassword] = createSignal("");
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordLoading, setPasswordLoading] = createSignal(false);

  // ── Action Handlers ──────────────────────────────────
  const handleAddReward = async (e: Event) => {
    e.preventDefault();
    setRewardError(null);
    setRewardSuccess(false);

    if (!rewardTitle().trim() || rewardCost() <= 0) {
      setRewardError("Valid reward title and point cost are required");
      return;
    }

    try {
      const result = await storeActions.createReward({
        title: rewardTitle().trim(),
        cost: rewardCost(),
      });

      if (result) {
        setRewardTitle("");
        setRewardCost(10);
        setRewardSuccess(true);
        setTimeout(() => setRewardSuccess(false), 3000);
      }
    } catch (err: any) {
      setRewardError(err?.message || "Failed to add reward");
    }
  };

  const handleAddChild = async (e: Event) => {
    e.preventDefault();
    setChildError(null);
    setChildSuccess(false);

    if (
      !childName().trim() ||
      !childUsername().trim() ||
      !childEmail().trim() ||
      !childPassword()
    ) {
      setChildError("All fields are required");
      return;
    }

    if (childPassword().length < 6) {
      setChildError("Password must be at least 6 characters");
      return;
    }

    setChildLoading(true);
    try {
      const result = await storeActions.createChild({
        name: childName().trim(),
        username: childUsername().trim(),
        email: childEmail().trim(),
        password: childPassword(),
      });

      if (result) {
        setChildName("");
        setChildUsername("");
        setChildEmail("");
        setChildPassword("");
        setChildSuccess(true);
        setTimeout(() => setChildSuccess(false), 3000);
      }
    } catch (err: any) {
      setChildError(err?.message || "Failed to create child account");
    } finally {
      setChildLoading(false);
    }
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    const childId = targetChildId();
    if (childId === "") {
      setPasswordError("Please select a child member");
      return;
    }
    if (!newPassword() || newPassword().length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    setPasswordLoading(true);
    try {
      const result = await storeActions.changeChildPassword(
        childId,
        newPassword(),
      );
      if (result?.success) {
        setTargetChildId("");
        setNewPassword("");
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update child password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div class="app-view settings-view flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Page Header */}
      <div class="flex flex-col gap-1.5 p-1">
        <h2 class="text-3xl font-black text-slate-100 tracking-tight">
          Household settings
        </h2>
        <p class="text-sm text-slate-400 max-w-xl">
          Manage your household by configuring store reward items and creating
          child member accounts.
        </p>
      </div>

      {/* Settings Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Section 1: Reward Form */}
        <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Add a reward
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Create a new reward child accounts can redeem using their
              hard-earned points.
            </p>
          </div>

          <Show when={rewardSuccess()}>
            <div class="rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-teal-400">
                Reward added.
              </p>
            </div>
          </Show>
          <Show when={rewardError()}>
            <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-rose-400">{rewardError()}</p>
            </div>
          </Show>

          <form onSubmit={handleAddReward} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="reward-name" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Reward Name
              </label>
              <input
                id="reward-name"
                type="text"
                placeholder="Extra 30 minutes of screen time"
                class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                value={rewardTitle()}
                onInput={(e) => setRewardTitle(e.currentTarget.value)}
                required
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="reward-cost" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Point Cost
              </label>
              <input
                id="reward-cost"
                type="number"
                min="1"
                placeholder="50"
                class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                value={rewardCost()}
                onInput={(e) => setRewardCost(Number(e.currentTarget.value))}
                required
              />
            </div>
            <button
              type="submit"
              class="btn rounded-xl font-bold border-0 bg-teal-400 hover:bg-teal-300 text-slate-950 mt-2 w-full"
            >
              Create Reward
            </button>
          </form>
        </section>

        {/* Section 2: Add Family Member Form */}
        <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Add a child account
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Add a child account to your household board so they can claim
              tasks and earn points.
            </p>
          </div>

          <Show when={childSuccess()}>
            <div class="rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-teal-400">
                Child account created.
              </p>
            </div>
          </Show>
          <Show when={childError()}>
            <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-rose-400">{childError()}</p>
            </div>
          </Show>

          <form onSubmit={handleAddChild} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="child-name" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Full Name
              </label>
              <input
                id="child-name"
                type="text"
                placeholder="Emma"
                class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                value={childName()}
                onInput={(e) => setChildName(e.currentTarget.value)}
                required
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="child-username" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  Username
                </label>
                <input
                  id="child-username"
                  type="text"
                  placeholder="emma"
                  class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                  value={childUsername()}
                  onInput={(e) => setChildUsername(e.currentTarget.value)}
                  required
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="child-email" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  Email
                </label>
                <input
                  id="child-email"
                  type="email"
                  placeholder="emma@family.local"
                  class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                  value={childEmail()}
                  onInput={(e) => setChildEmail(e.currentTarget.value)}
                  required
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="child-password" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Password
              </label>
              <input
                id="child-password"
                type="password"
                placeholder="Min 6 characters"
                class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                value={childPassword()}
                onInput={(e) => setChildPassword(e.currentTarget.value)}
                required
                minlength="6"
              />
            </div>
            <button
              type="submit"
              disabled={childLoading()}
              class="btn rounded-xl font-bold border-0 bg-purple-600 hover:bg-purple-500 text-white mt-2 w-full disabled:opacity-50"
            >
              {childLoading() ? "Creating…" : "Add child"}
            </button>
          </form>
        </section>

        {/* Section 3: Change Child Password Form */}
        <section class="view-panel rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4 md:col-span-2 max-w-2xl mx-auto w-full mt-2">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              Change a child password
            </h3>
            <p class="text-xs text-slate-400 mt-1">
              Reset the password for any child account in your household.
            </p>
          </div>
          <Show when={passwordSuccess()}>
            <div class="rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-teal-400">
                Password changed.
              </p>
            </div>
          </Show>
          <Show when={passwordError()}>
            <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
              <p class="text-xs font-semibold text-rose-400">
                {passwordError()}
              </p>
            </div>
          </Show>
          <form onSubmit={handleChangePassword} class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="password-child" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  Select Child
                </label>
                <select
                  id="password-child"
                  class="select bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                  value={targetChildId()}
                  onChange={(e) =>
                    setTargetChildId(Number(e.currentTarget.value))
                  }
                  required
                >
                  <option value="">Choose a child…</option>
                  <For each={store.users.filter((u) => u.type === "child")}>
                    {(user) => (
                      <option value={user.id}>
                        {user.name} (@{user.username})
                      </option>
                    )}
                  </For>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="new-child-password" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  New Password
                </label>
                <input
                  id="new-child-password"
                  type="password"
                  placeholder="Min 6 characters"
                  class="input bg-slate-950 border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl text-slate-200 w-full"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  required
                  minlength="6"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={passwordLoading()}
              class="btn rounded-xl font-bold border-0 bg-indigo-600 hover:bg-indigo-500 text-white mt-2 w-full disabled:opacity-50 cursor-pointer"
            >
              {passwordLoading() ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
