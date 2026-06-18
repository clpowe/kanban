import { createResource, createEffect, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store } from "../store/app-store";
import { api } from "../lib/api";

const statusColors = {
  todo: "#6366f1", // Indigo
  doing: "#f59e0b", // Amber
  done: "#10b981", // Emerald
  archived: "#64748b", // Slate
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  doing: "In Progress",
  done: "Completed",
  archived: "Archived",
};

export default function Analytics() {
  const navigate = useNavigate();

  // Guard: Redirect non-parent users back to the board
  createEffect(() => {
    if (store.activeUser && store.activeUser.type !== "parent") {
      navigate("/", { replace: true });
    }
  });

  // Load backend analytics
  const [analytics] = createResource(() => api.getAnalytics());

  // ── Metrics Calculations ─────────────────────────────
  const totalTasks = () => {
    const counts = analytics()?.statusCounts || [];
    return counts.reduce((sum, item) => sum + item.count, 0);
  };

  const completedTasks = () => {
    const counts = analytics()?.statusCounts || [];
    return counts
      .filter((item) => item.status === "done" || item.status === "archived")
      .reduce((sum, item) => sum + item.count, 0);
  };

  const completionRate = () => {
    const total = totalTasks();
    if (total === 0) return 0;
    return Math.round((completedTasks() / total) * 100);
  };

  const topPerformer = () => {
    const stats = analytics()?.childStats || [];
    if (stats.length === 0) return null;
    return [...stats].sort(
      (a, b) => b.done + b.archived - (a.done + a.archived),
    )[0];
  };

  const totalHousePoints = () => {
    const stats = analytics()?.childStats || [];
    return stats.reduce((sum, item) => sum + item.points, 0);
  };

  // ── Donut Chart Data ─────────────────────────────────
  const donutData = () => {
    const data = analytics()?.statusCounts || [];
    const total = totalTasks();
    if (total === 0) return [];

    let accumulatedPercentage = 0;
    const radius = 35;
    const circumference = 2 * Math.PI * radius; // ~220

    return data.map((item) => {
      const percentage = item.count / total;
      const strokeLength = percentage * circumference;
      const strokeOffset = circumference - strokeLength;
      const rotation = accumulatedPercentage * 360 - 90;

      accumulatedPercentage += percentage;

      return {
        ...item,
        label: statusLabels[item.status] || item.status,
        percentage: Math.round(percentage * 100),
        strokeDash: `${strokeLength} ${circumference}`,
        rotation,
        color:
          statusColors[item.status as keyof typeof statusColors] || "#cccccc",
      };
    });
  };

  // ── Stacked Bar Chart Calculations ───────────────────
  const maxTasksForScale = () => {
    const stats = analytics()?.childStats || [];
    const totals = stats.map((c) => c.todo + c.doing + c.done + c.archived);
    const maxVal = Math.max(...totals, 5); // default minimum scale of 5
    return maxVal;
  };

  return (
    <div class="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Page Header */}
      <div class="flex flex-col gap-1.5 p-1">
        <span class="text-xs font-extrabold uppercase tracking-widest text-primary">
          Family Insights
        </span>
        <h2 class="text-3xl font-black text-slate-100 tracking-tight">
          Chores Analytics
        </h2>
        <p class="text-sm text-slate-400 max-w-xl">
          Track task completion rates, evaluate distribution balances, and
          monitor family chore milestones.
        </p>
      </div>

      <Show
        when={!analytics.loading}
        fallback={
          <div class="flex flex-col items-center justify-center p-20 gap-4">
            <div class="loading loading-spinner loading-lg text-primary"></div>
            <p class="text-sm font-semibold text-slate-500">
              Compiling statistics...
            </p>
          </div>
        }
      >
        <Show
          when={totalTasks() > 0}
          fallback={
            <div class="rounded-3xl border border-dashed border-slate-800 bg-slate-900/10 p-16 text-center max-w-md mx-auto mt-8">
              <span class="text-5xl">📊</span>
              <h3 class="text-lg font-bold text-slate-300 mt-4">
                No Data Available
              </h3>
              <p class="text-xs text-slate-500 mt-2">
                Create family tasks and assign them to children to populate
                analytics indicators.
              </p>
            </div>
          }
        >
          {/* Key Metrics Cards */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Completion Rate */}
            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between min-h-32">
              <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Completion Rate
                </span>
                <h3 class="text-3xl font-black text-slate-100 mt-1">
                  {completionRate()}%
                </h3>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 mt-4 overflow-hidden border border-slate-800">
                <div
                  class="bg-linear-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                  style={{ width: `${completionRate()}%` }}
                />
              </div>
            </div>

            {/* Top Performer */}
            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between min-h-32">
              <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Top Achiever
                </span>
                <Show
                  when={topPerformer()}
                  fallback={
                    <h3 class="text-lg font-bold text-slate-500 mt-2">
                      None yet
                    </h3>
                  }
                >
                  <h3 class="text-2xl font-black text-teal-400 mt-1 truncate">
                    {topPerformer()?.name}
                  </h3>
                  <p class="text-xs font-semibold text-slate-400 mt-1">
                    ✓ Completed{" "}
                    {topPerformer()!.done + topPerformer()!.archived} tasks
                  </p>
                </Show>
              </div>
            </div>

            {/* Total House Points */}
            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between min-h-32">
              <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total House Points
                </span>
                <h3 class="text-3xl font-black text-indigo-400 mt-1">
                  ⭐ {totalHousePoints()} pts
                </h3>
              </div>
              <p class="text-[10px] text-slate-500 mt-2">
                Accumulated child points across all family accounts.
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            {/* Donut Chart: Status Distribution */}
            <section class="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl flex flex-col gap-4">
              <div>
                <h4 class="text-md font-bold text-slate-200">
                  Task Status Distribution
                </h4>
                <p class="text-xs text-slate-500 mt-0.5">
                  Overview of current household task states.
                </p>
              </div>

              <div class="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                {/* SVG Donut */}
                <div class="relative w-36 h-36">
                  <svg class="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="35"
                      fill="transparent"
                      stroke="#0f172a"
                      stroke-width="12"
                    />
                    <For each={donutData()}>
                      {(seg) => (
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="transparent"
                          stroke={seg.color}
                          stroke-width="12"
                          stroke-dasharray={seg.strokeDash}
                          transform={`rotate(${seg.rotation} 50 50)`}
                          class="transition-all duration-300 hover:stroke-[14px] cursor-pointer"
                        />
                      )}
                    </For>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-2xl font-black text-slate-100">
                      {totalTasks()}
                    </span>
                    <span class="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest">
                      Total Tasks
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div class="flex flex-col gap-2.5 min-w-32">
                  <For each={donutData()}>
                    {(seg) => (
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ "background-color": seg.color }}
                        />
                        <div class="flex flex-col">
                          <span class="text-xs font-bold text-slate-300 leading-none">
                            {seg.label}
                          </span>
                          <span class="text-[10px] text-slate-500 mt-0.5">
                            {seg.count} ({seg.percentage}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </section>

            {/* Stacked Bar Chart: Comparison */}
            <section class="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl flex flex-col gap-4">
              <div>
                <h4 class="text-md font-bold text-slate-200">
                  Tasks per Family Member
                </h4>
                <p class="text-xs text-slate-500 mt-0.5">
                  Stacked chore progress comparisons per child.
                </p>
              </div>

              {/* Stacked Chart SVG */}
              <div class="w-full flex flex-col gap-3 justify-center py-2 h-48">
                <svg class="w-full h-full" viewBox="0 0 300 150">
                  {/* Grid Lines */}
                  <line
                    x1="30"
                    y1="20"
                    x2="290"
                    y2="20"
                    stroke="#1e293b"
                    stroke-dasharray="2 2"
                  />
                  <line
                    x1="30"
                    y1="70"
                    x2="290"
                    y2="70"
                    stroke="#1e293b"
                    stroke-dasharray="2 2"
                  />
                  <line
                    x1="30"
                    y1="120"
                    x2="290"
                    y2="120"
                    stroke="#1e293b"
                    stroke-dasharray="2 2"
                  />

                  {/* Y Axis line */}
                  <line x1="30" y1="10" x2="30" y2="120" stroke="#334155" />
                  {/* X Axis line */}
                  <line x1="30" y1="120" x2="290" y2="120" stroke="#334155" />

                  <For each={analytics()?.childStats}>
                    {(child, index) => {
                      const total =
                        child.todo + child.doing + child.done + child.archived;
                      const scale = maxTasksForScale();
                      const barWidth = 24;

                      // Calculate X positioning
                      const childCount = analytics()?.childStats.length || 1;
                      const xGap = 240 / childCount;
                      const xPos = 30 + xGap * index() + (xGap - barWidth) / 2;

                      // Scaled heights
                      const todoH = total > 0 ? (child.todo / scale) * 100 : 0;
                      const doingH =
                        total > 0 ? (child.doing / scale) * 100 : 0;
                      const doneH =
                        total > 0
                          ? ((child.done + child.archived) / scale) * 100
                          : 0;

                      return (
                        <g>
                          {/* Done Segment */}
                          <rect
                            x={xPos}
                            y={120 - doneH}
                            width={barWidth}
                            height={doneH}
                            fill={statusColors.done}
                            rx="2"
                            class="transition-all duration-300 hover:opacity-90"
                          />
                          {/* Doing Segment */}
                          <rect
                            x={xPos}
                            y={120 - doneH - doingH}
                            width={barWidth}
                            height={doingH}
                            fill={statusColors.doing}
                            rx="2"
                            class="transition-all duration-300 hover:opacity-90"
                          />
                          {/* Todo Segment */}
                          <rect
                            x={xPos}
                            y={120 - doneH - doingH - todoH}
                            width={barWidth}
                            height={todoH}
                            fill={statusColors.todo}
                            rx="2"
                            class="transition-all duration-300 hover:opacity-90"
                          />
                          {/* Child Label */}
                          <text
                            x={xPos + barWidth / 2}
                            y="136"
                            fill="#94a3b8"
                            font-size="8"
                            font-weight="bold"
                            text-anchor="middle"
                          >
                            {child.name}
                          </text>
                        </g>
                      );
                    }}
                  </For>
                </svg>
              </div>

              {/* Stacked Chart Legend */}
              <div class="flex items-center justify-center gap-4 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full"
                    style={{ "background-color": statusColors.todo }}
                  />
                  <span>To Do</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full"
                    style={{ "background-color": statusColors.doing }}
                  />
                  <span>In Progress</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full"
                    style={{ "background-color": statusColors.done }}
                  />
                  <span>Completed</span>
                </div>
              </div>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  );
}
