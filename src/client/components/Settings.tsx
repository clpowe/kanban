import { For, Show, createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";

export default function Settings() {
  const navigate = useNavigate();

  createEffect(
    () => Boolean(store.activeUser) && store.activeUser?.type !== "parent",
    (mustRedirect) => {
      if (mustRedirect) navigate("/", { replace: true });
    },
  );

  const [rewardTitle, setRewardTitle] = createSignal("");
  const [rewardCost, setRewardCost] = createSignal(10);
  const [rewardSuccess, setRewardSuccess] = createSignal(false);
  const [rewardError, setRewardError] = createSignal<string | null>(null);

  const [childName, setChildName] = createSignal("");
  const [childUsername, setChildUsername] = createSignal("");
  const [childEmail, setChildEmail] = createSignal("");
  const [childPassword, setChildPassword] = createSignal("");
  const [childError, setChildError] = createSignal<string | null>(null);
  const [childSuccess, setChildSuccess] = createSignal(false);
  const [childLoading, setChildLoading] = createSignal(false);

  const [targetChildId, setTargetChildId] = createSignal<number | "">("");
  const [newPassword, setNewPassword] = createSignal("");
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordLoading, setPasswordLoading] = createSignal(false);

  const handleAddReward = async (event: Event) => {
    event.preventDefault();
    setRewardError(null);
    setRewardSuccess(false);

    if (!rewardTitle().trim() || rewardCost() <= 0) {
      setRewardError("Add a reward name and a point cost above zero.");
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
    } catch (error: any) {
      setRewardError(error?.message || "The reward was not created. Try again.");
    }
  };

  const handleAddChild = async (event: Event) => {
    event.preventDefault();
    setChildError(null);
    setChildSuccess(false);

    if (
      !childName().trim() ||
      !childUsername().trim() ||
      !childEmail().trim() ||
      !childPassword()
    ) {
      setChildError("Complete every field before adding the child account.");
      return;
    }

    if (childPassword().length < 6) {
      setChildError("Use at least six characters for the password.");
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
    } catch (error: any) {
      setChildError(error?.message || "The child account was not created. Try again.");
    } finally {
      setChildLoading(false);
    }
  };

  const handleChangePassword = async (event: Event) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (targetChildId() === "") {
      setPasswordError("Choose a child account first.");
      return;
    }

    if (newPassword().length < 6) {
      setPasswordError("Use at least six characters for the new password.");
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await storeActions.changeChildPassword(
        targetChildId() as number,
        newPassword(),
      );
      if (result?.success) {
        setTargetChildId("");
        setNewPassword("");
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (error: any) {
      setPasswordError(error?.message || "The password did not update. Try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <section class="app-view settings-view">
      <header class="page-lead">
        <div>
          <h1>Household settings</h1>
          <p>Manage rewards, child accounts, and family access.</p>
        </div>
      </header>

      <div class="settings-grid">
        <form class="settings-panel reward-settings" onSubmit={handleAddReward}>
          <header>
            <h2>Add a reward</h2>
            <p>Create something children can redeem with earned points.</p>
          </header>

          <Show when={rewardSuccess()}>
            <p class="form-status" data-state="success" role="status">Reward added.</p>
          </Show>
          <Show when={rewardError()}>
            <p class="form-status" data-state="error" role="alert">{rewardError()}</p>
          </Show>

          <label>
            Reward name
            <input
              type="text"
              placeholder="Extra 30 minutes of screen time"
              value={rewardTitle()}
              onInput={(event) => setRewardTitle(event.currentTarget.value)}
              required
            />
          </label>
          <label>
            Point cost
            <input
              type="number"
              min="1"
              placeholder="50"
              value={rewardCost()}
              onInput={(event) => setRewardCost(Number(event.currentTarget.value))}
              required
            />
          </label>
          <button type="submit" class="primary">Create reward</button>
        </form>

        <form class="settings-panel child-settings" onSubmit={handleAddChild}>
          <header>
            <h2>Add a child account</h2>
            <p>Add a child to the household board.</p>
          </header>

          <Show when={childSuccess()}>
            <p class="form-status" data-state="success" role="status">Child account created.</p>
          </Show>
          <Show when={childError()}>
            <p class="form-status" data-state="error" role="alert">{childError()}</p>
          </Show>

          <label>
            Full name
            <input
              type="text"
              placeholder="Emma"
              value={childName()}
              onInput={(event) => setChildName(event.currentTarget.value)}
              required
            />
          </label>
          <div class="field-row">
            <label>
              Username
              <input
                type="text"
                placeholder="emma"
                value={childUsername()}
                onInput={(event) => setChildUsername(event.currentTarget.value)}
                required
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                placeholder="emma@family.local"
                value={childEmail()}
                onInput={(event) => setChildEmail(event.currentTarget.value)}
                required
              />
            </label>
          </div>
          <label>
            Password
            <input
              type="password"
              placeholder="At least 6 characters"
              value={childPassword()}
              onInput={(event) => setChildPassword(event.currentTarget.value)}
              required
              minlength="6"
            />
          </label>
          <button type="submit" class="primary" disabled={childLoading()} aria-busy={childLoading() ? "true" : "false"}>
            {childLoading() ? "Creating…" : "Add child"}
          </button>
        </form>

        <form class="settings-panel password-settings" onSubmit={handleChangePassword}>
          <header>
            <h2>Change a child password</h2>
            <p>Replace the password for an existing child account.</p>
          </header>

          <Show when={passwordSuccess()}>
            <p class="form-status" data-state="success" role="status">Password changed.</p>
          </Show>
          <Show when={passwordError()}>
            <p class="form-status" data-state="error" role="alert">{passwordError()}</p>
          </Show>

          <div class="field-row">
            <label>
              Child account
              <select
                value={targetChildId()}
                onChange={(event) =>
                  setTargetChildId(event.currentTarget.value ? Number(event.currentTarget.value) : "")
                }
                required
              >
                <option value="">Choose a child…</option>
                <For each={store.users.filter((user) => user.type === "child")}>
                  {(user) => <option value={user.id}>{user.name} (@{user.username})</option>}
                </For>
              </select>
            </label>
            <label>
              New password
              <input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword()}
                onInput={(event) => setNewPassword(event.currentTarget.value)}
                required
                minlength="6"
              />
            </label>
          </div>
          <button type="submit" class="primary" disabled={passwordLoading()} aria-busy={passwordLoading() ? "true" : "false"}>
            {passwordLoading() ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
