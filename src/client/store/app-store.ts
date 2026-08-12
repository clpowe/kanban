import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { api } from "../lib/api";
import type {
  Task,
  RewardView,
  User,
  TaskUpdate,
  CreateTask,
} from "../../types";
import { tasks } from "../../db/schema";

// Global Loading & Error State
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

// Core Global State
const [store, setStore] = createStore<{
  users: User[];
  tasks: Task[];
  rewards: RewardView[];
  activeUser: User | null;
}>({
  users: [],
  tasks: [],
  rewards: [],
  activeUser: null,
});

// Async Helper wrapper to automatically track global loading & catch-all errors
async function runStoreAction<T>(
  action: () => Promise<T>,
): Promise<T | undefined> {
  setIsLoading(true);
  setError(null);
  try {
    return await action();
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "An unexpected error occurred";
    setError(msg);
    console.error("[Store Action Error]:", err);
    return undefined;
  } finally {
    setIsLoading(false);
  }
}

// Full Sync Fetch - Bootstraps the application data in parallel
async function fetchBoardData() {
  await runStoreAction(async () => {
    const [activeTasks, archivedTasks, rewards, users, activeUser] =
      await Promise.all([
      api.getTasks(),
      api.getArchivedTasks(),
      api.getRewards(),
      api.getUsers(),
      api.getActiveUser(),
    ]);
    setStore({
      tasks: [...activeTasks, ...archivedTasks],
      rewards: rewards,
      users: users,
      activeUser: activeUser,
    });
  });
}

// Targeted refresh sync actions
async function reloadUsers() {
  const users = await api.getUsers();
  setStore("users", users);
}

async function reloadTasks() {
  const [activeTasks, archivedTasks] = await Promise.all([
    api.getTasks(),
    api.getArchivedTasks(),
  ]);
  setStore("tasks", [...activeTasks, ...archivedTasks]);
}

async function reloadActiveUser() {
  const activeUser = await api.getActiveUser();
  setStore("activeUser", activeUser);
}

async function reloadRewards() {
  const rewards = await api.getRewards();
  setStore("rewards", rewards);
}

export const storeActions = {
  // Load entire board state at boot
  async initialize() {
    await fetchBoardData();
  },

  // Session Actions
  async switchActiveUser(userId: number) {
    await runStoreAction(async () => {
      const result = await api.switchActiveUser(userId);
      if (result.success) {
        // Re-synchronize entire state for the newly active family member
        await fetchBoardData();
      }
    });
  },

  // Task Actions
  async addTask(task: CreateTask) {
    return await runStoreAction(async () => {
      const newTask = await api.createTask(task);
      setStore("tasks", (prev) => [...prev, newTask]);
      await reloadTasks(); // Keep database status perfectly aligned
      return newTask;
    });
  },

  async updateTaskStatus(id: number, status: string) {
    const eventId = crypto.randomUUID();
    await runStoreAction(async () => {
      const updatedTask = await api.updateTaskStatus(id, status, eventId);
      setStore("tasks", (task) => task.id === id, updatedTask);
      // Points updates happen automatically on the server when tasks are marked Done.
      // Therefore, we MUST pull fresh scores to update our local users and session context.
      await Promise.all([reloadUsers(), reloadActiveUser()]);
    });
  },

  async updateTask(id: number, updates: TaskUpdate) {
    await runStoreAction(async () => {
      const updatedTask = await api.updateTask(id, updates);
      setStore("tasks", (task) => task.id === id, updatedTask);
      // Reload users and activeUser in case task updates affected points or assignee
      await Promise.all([reloadUsers(), reloadActiveUser()]);
    });
  },

  async deleteTask(id: number) {
    await runStoreAction(async () => {
      const result = await api.deleteTask(id);
      if (result.success) {
        setStore("tasks", (prev) => prev.filter((t) => t.id !== id));
      }
    });
  },

  // Reward Actions
  async createReward(reward: { title: string; cost: number }) {
    return await runStoreAction(async () => {
      const newReward = await api.createReward(reward);
      setStore("rewards", (prev) => [...prev, newReward]);
      await reloadRewards();
      return newReward;
    });
  },

  async redeemReward(id: number) {
    await runStoreAction(async () => {
      const result = await api.redeemReward(id);
      if (result.success) {
        // Points are deducted from the user on redemption, sync local scores
        await Promise.all([reloadUsers(), reloadActiveUser()]);
      }
    });
  },

  // Child Account Actions
  async createChild(data: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) {
    return await runStoreAction(async () => {
      const newUser = await api.createChild(data);
      // Refresh user list so the new child appears in switcher and assignee dropdowns
      await reloadUsers();
      return newUser;
    });
  },

  async changeChildPassword(id: number, password: string) {
    return await runStoreAction(async () => {
      return await api.changeChildPassword(id, password);
    });
  },

  async updateUserAvatar(id: number, avatar: string) {
    return await runStoreAction(async () => {
      const result = await api.updateUserAvatar(id, avatar);
      if (result.success) {
        await Promise.all([reloadUsers(), reloadActiveUser()]);
      }
      return result;
    });
  },
};

export { store, isLoading, error };
