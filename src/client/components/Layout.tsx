import { Show, For, createSignal } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { store, storeActions } from "../store/app-store";
import { authClient } from "../lib/auth-client";

function SunIcon() {
  return (
    <svg
      class="theme-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      class="theme-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20.4 14.4A8.4 8.4 0 0 1 9.6 3.6a8.5 8.5 0 1 0 10.8 10.8Z" />
    </svg>
  );
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = authClient.useSession();

  const isBoard = () => location.pathname === "/";
  const isArchive = () => location.pathname === "/archived";
  const isSettings = () => location.pathname === "/settings";
  const isRewards = () => location.pathname === "/rewards";
  const isAnalytics = () => location.pathname === "/analytics";
  const isParent = () => store.activeUser?.type === "parent";
  const isProfile = () => location.pathname === "/profile";

  const switchableUsers = () => {
    const isParentSession = session().data?.user?.type === "parent";
    if (!isParentSession) {
      return store.users.filter((u) => u.type !== "parent");
    }
    return store.users;
  };

  const [theme, setTheme] = createSignal(
    document.documentElement.getAttribute("data-theme") || "corporate",
  );
  const [navOpen, setNavOpen] = createSignal(false);

  const toggleTheme = () => {
    const nextTheme = theme() === "corporate" ? "business" : "corporate";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  const handleUserSwitch = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const userId = Number(target.value);
    if (!Number.isNaN(userId)) {
      storeActions.switchActiveUser(userId);
    }
  };

  const openTaskDrawer = () => {
    const toggle = document.getElementById(
      "task-drawer",
    ) as HTMLInputElement | null;
    if (toggle) toggle.checked = true;
  };

  const pageLinkClass = () => "app-nav__link";

  return (
    <header class="app-nav">
      <A href="/" class="app-brand" aria-label="Family Task home">
        <span class="brand-character" aria-hidden="true">
          FT
        </span>
        <span class="app-brand__copy">
          <span class="app-brand__name">Family Task</span>
        </span>
      </A>

      <nav
        class="app-nav__links"
        data-open={navOpen()}
        aria-label="Primary navigation"
      >
        <A
          href="/"
          class={pageLinkClass()}
          aria-current={isBoard() ? "page" : undefined}
          onClick={() => setNavOpen(false)}
        >
          Board
        </A>
        <A
          href="/archived"
          class={pageLinkClass()}
          aria-current={isArchive() ? "page" : undefined}
          onClick={() => setNavOpen(false)}
        >
          Archive
        </A>
        <Show when={isParent()}>
          <A
            href="/analytics"
            class={pageLinkClass()}
            aria-current={isAnalytics() ? "page" : undefined}
            onClick={() => setNavOpen(false)}
          >
            Analytics
          </A>
        </Show>
        <A
          href="/rewards"
          class={pageLinkClass()}
          aria-current={isRewards() ? "page" : undefined}
          onClick={() => setNavOpen(false)}
        >
          Rewards
        </A>
        <Show when={store.activeUser?.type === "child"}>
          <A
            href="/profile"
            class={pageLinkClass()}
            aria-current={isProfile() ? "page" : undefined}
            onClick={() => setNavOpen(false)}
          >
            Badges
          </A>
        </Show>
        <Show when={isParent()}>
          <A
            href="/settings"
            class={pageLinkClass()}
            aria-current={isSettings() ? "page" : undefined}
            onClick={() => setNavOpen(false)}
          >
            Settings
          </A>
        </Show>
      </nav>

      <div class="app-nav__actions">
        <select
          id="active-user-id"
          class="select app-nav__user"
          aria-label="Active family member"
          value={store.activeUser?.id || ""}
          onChange={handleUserSwitch}
        >
          <For each={switchableUsers()}>
            {(u) => (
              <option value={u.id} selected={u.id === store.activeUser?.id}>
                {u.name} · {u.type}
              </option>
            )}
          </For>
        </select>

        <button
          type="button"
          onClick={toggleTheme}
          class="btn btn-ghost btn-circle app-nav__theme"
          title={
            theme() === "corporate" ? "Use night theme" : "Use light theme"
          }
          aria-label={
            theme() === "corporate" ? "Use night theme" : "Use light theme"
          }
        >
          <Show when={theme() === "corporate"} fallback={<MoonIcon />}>
            <SunIcon />
          </Show>
        </button>

        <Show when={isParent()}>
          <button
            type="button"
            class="btn cursor-pointer app-nav__add"
            onClick={openTaskDrawer}
          >
            Add task
          </button>
        </Show>

        <button
          type="button"
          onClick={handleLogout}
          class="btn btn-ghost app-nav__logout"
        >
          Sign out
        </button>

        <button
          type="button"
          class="btn btn-ghost app-nav__menu"
          aria-label="Toggle navigation"
          aria-expanded={navOpen()}
          onClick={() => setNavOpen(!navOpen())}
        >
          <span class="app-nav__menu-lines" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
