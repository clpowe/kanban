import { createEffect, Show } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import { store, isLoading, storeActions } from "./store/app-store";
import { authClient } from "./lib/auth-client";
import Board from "./components/Board";
import Archive from "./components/Archive";
import Drawers from "./components/Drawers";
import Navbar from "./components/Layout";
import PointCards from "./components/PointsCards";
import Login from "./components/Login";
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
        <div class="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
          <div class="relative flex items-center justify-center">
            <div class="absolute h-24 w-24 rounded-full border border-indigo-500/30 animate-ping opacity-75" />
            <div class="absolute h-16 w-16 rounded-full border border-violet-500/30 animate-pulse" />
            <div class="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
              <span class="text-xs font-bold tracking-widest text-white/90">
                K
              </span>
            </div>
          </div>
          <h2 class="mt-6 text-sm font-semibold tracking-wider uppercase text-slate-400 animate-pulse">
            Syncing Household...
          </h2>
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
      {/* Login route — outside the authenticated layout */}
      <Route path="/login" component={Login} />
      {/* Protected routes — wrapped in AppLayout */}
      <Route path="/" component={AppLayout}>
        <Route path="/" component={Board} />
        <Route path="/archived" component={Archive} />
      </Route>
    </Router>
  );
}
