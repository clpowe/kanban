import { createEffect, Show } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import { store, storeActions } from "./store/app-store";
import { authClient } from "./lib/auth-client";
import Board from "./components/Board";
import Archive from "./components/Archive";
import Drawers from "./components/Drawers";
import Navbar from "./components/Layout";
import PointCards from "./components/PointsCards";
import Login from "./components/Login";
import Register from "./components/Register";
import Settings from "./components/Settings";
import Rewards from "./components/Rewards";
import Analytics from "./components/Analytics";
import Profile from "./components/Profile";
import type { JSX } from "solid-js";

// ── AppLayout (Route Wrapper) ───────────────────────────
// This component acts as the shell layout for all routes,
// ensuring routing hooks (useLocation, <A>) are fully valid.
function AppLayout(props: { children?: JSX.Element }) {
  const session = authClient.useSession();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  createEffect(() => {
    if (!session().isPending && !session().data) {
      navigate("/login", { replace: true });
    }
  });

  // Initialize store when session is confirmed
  createEffect(() => {
    if (session().data && store.users.length === 0) {
      storeActions.initialize();
    }
  });

  return (
    <Show
      when={session().data}
      fallback={
        <div class="app-shell min-h-screen flex flex-col items-center justify-center gap-5 px-4">
          <span class="brand-character" aria-hidden="true">
            FT
          </span>
          <h2 class="text-xl font-bold text-slate-100">
            Getting your board ready…
          </h2>
          <span class="loading loading-dots loading-md text-primary" aria-hidden="true" />
        </div>
      }
    >
      <Drawers>
        <Navbar />
        <PointCards />
        {/* The active route component (Board or Archive) will render here */}
        {props.children}
      </Drawers>
    </Show>
  );
}

// ── App ─────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      {/* Login & Register routes — outside the authenticated layout */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Protected routes — wrapped in AppLayout */}
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
