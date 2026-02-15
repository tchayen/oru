import { useState, useEffect, useCallback } from "react";
import { useNavigation } from "expo-router";
import {
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  sortTasks,
} from "@/utils/api";

export function useTasks(serverUrl: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  const load = useCallback(async () => {
    try {
      const data = await fetchTasks(serverUrl);
      setTasks(sortTasks(data.filter((t) => t.status !== "done")));
      setError(null);
    } catch {
      setTasks([]);
      setError("Server unreachable. Check that ao server is running.");
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return navigation.addListener("focus", () => {
      load();
    });
  }, [navigation, load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const add = useCallback(
    async (input: CreateTaskInput) => {
      const task = await createTask(serverUrl, input);
      setTasks((prev) => sortTasks([task, ...prev]));
      return task;
    },
    [serverUrl],
  );

  const update = useCallback(
    async (id: string, input: UpdateTaskInput) => {
      const updated = await updateTask(serverUrl, id, input);
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === id ? updated : t)).filter((t) => t.status !== "done")),
      );
      return updated;
    },
    [serverUrl],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTask(serverUrl, id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [serverUrl],
  );

  return { tasks, isLoading, isRefreshing, error, refresh, add, update, remove };
}
