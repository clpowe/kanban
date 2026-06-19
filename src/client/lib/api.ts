import type {
  Task,
  User,
  RewardView,
  TaskUpdate,
  CreateTask,
} from "../../types";

// Centralized fetch wrapper with robust error parsing
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    let errorJson: { error?: string } | null = null;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Body is not JSON
    }
    throw new Error(
      errorJson?.error ||
        errorText ||
        `Request failed with status: ${res.statusText}`,
    );
  }

  // Handle successful 204 No Content
  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // --- Session Endpoints ---
  async getActiveUser(): Promise<User> {
    const data = await apiFetch<{ user: User }>("/session/active-user");
    return data.user;
  },
  async switchActiveUser(
    userId: number,
  ): Promise<{ success: boolean; activeUserId: number }> {
    return apiFetch<{ success: boolean; activeUserId: number }>(
      "/session/active-user",
      {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      },
    );
  },

  // --- User Endpoints ---
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>("/api/users");
  },

  async createChild(data: {
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<User> {
    return apiFetch<User>("/api/users/children", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async changeChildPassword(
    id: number,
    password: string,
  ): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  // --- Task Endpoints ---
  async getTasks(): Promise<Task[]> {
    return apiFetch<Task[]>("/api/tasks");
  },

  async createTask(task: CreateTask): Promise<Task> {
    return apiFetch<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
  },

  async updateTaskStatus(id: number, status: string): Promise<Task> {
    return apiFetch<Task>(`/api/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async updateTask(id: number, updates: TaskUpdate): Promise<Task> {
    return apiFetch<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  },

  // --- Reward Endpoints ---
  async getRewards(): Promise<RewardView[]> {
    return apiFetch<RewardView[]>("/api/rewards");
  },

  async createReward(reward: {
    title: string;
    cost: number;
  }): Promise<RewardView> {
    return apiFetch<RewardView>("/api/rewards", {
      method: "POST",
      body: JSON.stringify(reward),
    });
  },

  async redeemReward(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/rewards/${id}/redeem`, {
      method: "POST",
    });
  },

  // --- Analytics Endpoints ---
  async getAnalytics(): Promise<{
    statusCounts: { status: string; count: number }[];
    childStats: {
      childId: number;
      name: string;
      username: string;
      points: number;
      todo: number;
      doing: number;
      done: number;
      archived: number;
    }[];
  }> {
    return apiFetch("/api/analytics");
  },
};
