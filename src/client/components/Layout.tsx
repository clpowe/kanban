import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { authClient, useSession } from "../lib/auth-client";

export default function HouseholdRail() {
  const navigate = useNavigate();
  const session = useSession();

  const isParent = () => store.activeUser?.type === "parent";
  const switchableUsers = () =>
    session().data?.user?.type === "parent"
      ? store.users
      : store.users.filter((user) => user.type !== "parent");

  const closeMenu = () => {
    const menu = document.getElementById("mobile-menu") as HTMLDetailsElement | null;
    if (menu) menu.open = false;
  };

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  const handleUserSwitch = (event: Event) => {
    const userId = Number((event.currentTarget as HTMLSelectElement).value);
    if (!Number.isNaN(userId)) storeActions.switchActiveUser(userId);
  };

  const openTaskDialog = () => {
    const dialog = document.getElementById("task-dialog") as HTMLDialogElement | null;
    closeMenu();
    if (dialog && !dialog.open) dialog.showModal();
  };

  const NavLinks = (props: { mobile?: boolean }) => (
    <nav aria-label={props.mobile ? "Mobile navigation" : "Primary navigation"}>
      {/* The router sets aria-current/data-active on claimed anchors. */}
      <a href="/" onClick={closeMenu}>
        Board
      </a>
      <a href="/archived" onClick={closeMenu}>
        Archive
      </a>
      <Show when={isParent()}>
        <a href="/analytics" onClick={closeMenu}>
          Analytics
        </a>
      </Show>
      <a href="/rewards" onClick={closeMenu}>
        Rewards
      </a>
      <Show when={store.activeUser?.type === "child"}>
        <a href="/profile" onClick={closeMenu}>
          Badges
        </a>
      </Show>
      <Show when={isParent()}>
        <a href="/settings" onClick={closeMenu}>
          Settings
        </a>
      </Show>
    </nav>
  );

  const UserPicker = (props: { id: string }) => (
    <label class="user-picker" for={props.id}>
      Viewing as
      <select id={props.id} value={store.activeUser?.id || ""} onChange={handleUserSwitch}>
        <For each={switchableUsers()}>
          {(user) => (
            <option value={user.id} selected={user.id === store.activeUser?.id}>
              {user.name} · {user.type}
            </option>
          )}
        </For>
      </select>
    </label>
  );

  return (
    <header class="household-rail">
      <a href="/" class="wordmark" aria-label="Family Task home">
        <span class="wordmark-mark" aria-hidden="true">FT</span>
        <span>
          <strong>Family Task</strong>
          <small>Household board</small>
        </span>
      </a>

      <div class="desktop-navigation">
        <NavLinks />
      </div>

      <div class="rail-actions">
        <UserPicker id="active-user-id" />
        <Show when={isParent()}>
          <button type="button" class="primary" onClick={openTaskDialog}>
            Add task
          </button>
        </Show>
        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <details id="mobile-menu" class="mobile-menu">
        <summary>Menu</summary>
        <div class="mobile-menu-panel">
          <NavLinks mobile />
          <UserPicker id="mobile-active-user-id" />
          <Show when={isParent()}>
            <button type="button" class="primary" onClick={openTaskDialog}>
              Add task
            </button>
          </Show>
          <button type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </details>
    </header>
  );
}
