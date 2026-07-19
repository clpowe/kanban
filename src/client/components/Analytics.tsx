import { For, Show, createEffect, createResource } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { store } from "../store/app-store";
import { api } from "../lib/api";

const statusColors = {
  todo: "var(--color-blue)",
  doing: "var(--color-yellow)",
  done: "var(--color-mint)",
  archived: "var(--color-muted)",
};

const statusLabels: Record<string, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Completed",
  archived: "Archived",
};

export default function Analytics() {
  const navigate = useNavigate();

  createEffect(() => {
    if (store.activeUser && store.activeUser.type !== "parent") {
      navigate("/", { replace: true });
    }
  });

  const [analytics] = createResource(() => api.getAnalytics());

  const totalTasks = () =>
    (analytics()?.statusCounts || []).reduce((sum, item) => sum + item.count, 0);

  const completedTasks = () =>
    (analytics()?.statusCounts || [])
      .filter((item) => item.status === "done" || item.status === "archived")
      .reduce((sum, item) => sum + item.count, 0);

  const completionRate = () =>
    totalTasks() === 0 ? 0 : Math.round((completedTasks() / totalTasks()) * 100);

  const topPerformer = () => {
    const stats = analytics()?.childStats || [];
    return [...stats].sort(
      (a, b) => b.done + b.archived - (a.done + a.archived),
    )[0] || null;
  };

  const totalHousePoints = () =>
    (analytics()?.childStats || []).reduce((sum, item) => sum + item.points, 0);

  const donutData = () => {
    const data = analytics()?.statusCounts || [];
    const total = totalTasks();
    if (total === 0) return [];

    let accumulated = 0;
    const circumference = 2 * Math.PI * 35;

    return data.map((item) => {
      const percentage = item.count / total;
      const strokeLength = percentage * circumference;
      const rotation = accumulated * 360 - 90;
      accumulated += percentage;

      return {
        ...item,
        label: statusLabels[item.status] || item.status,
        percentage: Math.round(percentage * 100),
        strokeDash: `${strokeLength} ${circumference}`,
        rotation,
        color:
          statusColors[item.status as keyof typeof statusColors] ||
          "var(--color-muted)",
      };
    });
  };

  const maxTasksForScale = () => {
    const totals = (analytics()?.childStats || []).map(
      (child) => child.todo + child.doing + child.done + child.archived,
    );
    return Math.max(...totals, 5);
  };

  return (
    <section class="app-view analytics-view">
      <header class="page-lead">
        <div>
          <h1>Household progress</h1>
          <p>See what gets finished, who needs room, and how work is shared.</p>
        </div>
      </header>

      <Show
        when={!analytics.loading}
        fallback={
          <section class="analytics-skeleton" aria-label="Loading household progress" aria-busy="true">
            <i />
            <i />
            <i />
          </section>
        }
      >
        <Show
          when={totalTasks() > 0}
          fallback={
            <section class="empty-state">
              <h2>No progress data yet</h2>
              <p>Create and assign tasks to populate household analytics.</p>
            </section>
          }
        >
          <div class="analytics-bento">
            <article class="completion-card">
              <header>
                <h2>Completion</h2>
                <span>All recorded tasks</span>
              </header>
              <strong>{completionRate()}%</strong>
              <meter min="0" max="100" value={completionRate()}>
                {completionRate()}%
              </meter>
            </article>

            <article class="performer-card">
              <h2>Top achiever</h2>
              <Show when={topPerformer()} fallback={<p>No completions yet.</p>}>
                <strong>{topPerformer()?.name}</strong>
                <p>{(topPerformer()?.done || 0) + (topPerformer()?.archived || 0)} tasks completed</p>
              </Show>
            </article>

            <article class="points-card">
              <h2>House points</h2>
              <strong>{totalHousePoints()}</strong>
              <span>currently held</span>
            </article>

            <section class="status-chart">
              <header>
                <h2>Task distribution</h2>
                <p>Current household states.</p>
              </header>

              <div class="donut-layout">
                <figure>
                  <svg viewBox="0 0 100 100" role="img" aria-label="Task status distribution chart">
                    <circle
                      cx="50"
                      cy="50"
                      r="35"
                      fill="var(--color-transparent)"
                      stroke="var(--color-rule)"
                      stroke-width="12"
                    />
                    <For each={donutData()}>
                      {(segment) => (
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="var(--color-transparent)"
                          stroke={segment.color}
                          stroke-width="12"
                          stroke-dasharray={segment.strokeDash}
                          transform={`rotate(${segment.rotation} 50 50)`}
                        />
                      )}
                    </For>
                    <text x="50" y="49" text-anchor="middle">{totalTasks()}</text>
                    <text x="50" y="60" text-anchor="middle">tasks</text>
                  </svg>
                </figure>

                <ul>
                  <For each={donutData()}>
                    {(segment) => (
                      <li style={{ "--legend-color": segment.color }}>
                        <span>{segment.label}</span>
                        <strong>{segment.count} · {segment.percentage}%</strong>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </section>

            <section class="member-chart">
              <header>
                <h2>Tasks by family member</h2>
                <p>Work states per child.</p>
              </header>

              <svg viewBox="0 0 300 160" role="img" aria-label="Tasks per family member chart">
                <line x1="30" y1="20" x2="290" y2="20" />
                <line x1="30" y1="70" x2="290" y2="70" />
                <line x1="30" y1="120" x2="290" y2="120" />

                <For each={analytics()?.childStats}>
                  {(child, index) => {
                    const total = child.todo + child.doing + child.done + child.archived;
                    const barWidth = 24;
                    const childCount = analytics()?.childStats.length || 1;
                    const xGap = 240 / childCount;
                    const x = 30 + xGap * index() + (xGap - barWidth) / 2;
                    const doneHeight =
                      total > 0
                        ? ((child.done + child.archived) / maxTasksForScale()) * 100
                        : 0;
                    const doingHeight =
                      total > 0 ? (child.doing / maxTasksForScale()) * 100 : 0;
                    const todoHeight =
                      total > 0 ? (child.todo / maxTasksForScale()) * 100 : 0;

                    return (
                      <g>
                        <rect
                          x={x}
                          y={120 - doneHeight}
                          width={barWidth}
                          height={doneHeight}
                          fill={statusColors.done}
                          rx="4"
                        />
                        <rect
                          x={x}
                          y={120 - doneHeight - doingHeight}
                          width={barWidth}
                          height={doingHeight}
                          fill={statusColors.doing}
                          rx="4"
                        />
                        <rect
                          x={x}
                          y={120 - doneHeight - doingHeight - todoHeight}
                          width={barWidth}
                          height={todoHeight}
                          fill={statusColors.todo}
                          rx="4"
                        />
                        <text x={x + barWidth / 2} y="140" text-anchor="middle">
                          {child.name}
                        </text>
                      </g>
                    );
                  }}
                </For>
              </svg>

              <ul class="chart-legend">
                <li data-status="todo">To do</li>
                <li data-status="doing">In progress</li>
                <li data-status="done">Completed</li>
              </ul>
            </section>
          </div>
        </Show>
      </Show>
    </section>
  );
}
