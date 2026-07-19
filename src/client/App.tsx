import { createEffect, Show } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import { store, storeActions } from "./store/app-store";
import { authClient } from "./lib/auth-client";
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
import type { JSX } from "solid-js";

function AppLayout(props: { children?: JSX.Element }) {
  const session = authClient.useSession();
  const navigate = useNavigate();

  createEffect(() => {
    if (!session().isPending && !session().data) {
      navigate("/login", { replace: true });
    }
  });

  createEffect(() => {
    if (session().data && store.users.length === 0) {
      storeActions.initialize();
    }
  });

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

export default function App() {
  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      <Route path="/" component={AppLayout}>
        <Route path="/" component={Board} />
        <Route path="/archived" component={Archive} />
        <Route path="/settings" component={Settings} />
        <Route path="/rewards" component={Rewards} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/profile" component={Profile} />
      </Route>
    </Router>
  );
}
