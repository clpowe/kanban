import { createEffect, Show } from "solid-js";
import { createRouter, useNavigate } from "@solidjs/router";
import { store, storeActions } from "./store/app-store";
import { useSession } from "./lib/auth-client";
import Board from "./components/Board";
import Archive from "./components/Archive";
import AppShell from "./components/Drawers";
import Navbar from "./components/Layout";
import PointCards from "./components/PointsCards";
import Login from "./components/Login";
import Register from "./components/Register";
import Settings from "./components/Settings";
import Rewards from "./components/Rewards";
import Analytics from "./components/Analytics";
import Profile from "./components/Profile";
import type { JSX } from "@solidjs/web";

function AppLayout(props: { children?: JSX.Element }) {
  const session = useSession();
  const navigate = useNavigate();

  createEffect(
    () => !session().isPending && !session().data,
    (signedOut) => {
      if (signedOut) navigate("/login", { replace: true });
    },
  );

  createEffect(
    () => Boolean(session().data) && store.users.length === 0,
    (needsBootstrap) => {
      if (needsBootstrap) storeActions.initialize();
    },
  );

  return (
    <Show
      when={session().data}
      fallback={
        <main class="loading-screen">
          <strong aria-hidden="true">FT</strong>
          <h1>Getting your board ready…</h1>
          <progress aria-label="Loading board" />
        </main>
      }
    >
      <AppShell>
        <Navbar />
        <PointCards />
        {props.children}
      </AppShell>
    </Show>
  );
}

const Router = createRouter({
  routes: [
    { path: "/login", component: Login },
    { path: "/register", component: Register },
    {
      path: "/",
      component: AppLayout,
      children: [
        { path: "/", component: Board },
        { path: "/archived", component: Archive },
        { path: "/settings", component: Settings },
        { path: "/rewards", component: Rewards },
        { path: "/analytics", component: Analytics },
        { path: "/profile", component: Profile },
      ],
    },
  ],
});

export default function App() {
  return <Router />;
}
