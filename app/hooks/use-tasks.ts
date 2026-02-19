import { useState, useEffect, useCallback } from "react";
import { useNavigation } from "expo-router";
import { fetchTasks, createTask, updateTask, deleteTask, sortTasks } from "@/utils/api";
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/utils/api";

export function useTasks(serverUrl: string | null, authToken: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  const load = useCallback(async () => {
    try {
      const data = await fetchTasks(serverUrl, authToken);
      setTasks(sortTasks(data.filter((t) => t.status !== "done")));
      setError(null);
    } catch {
      setTasks([]);
      setError("Server unreachable. Check that oru server is running.");
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, authToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () =>
      navigation.addListener("focus", () => {
        load();
      }),
    [navigation, load],
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const add = useCallback(
    async (input: CreateTaskInput) => {
      const task = await createTask(serverUrl, authToken, input);
      setTasks((prev) => sortTasks([task, ...prev]));
      return task;
    },
    [serverUrl, authToken],
  );

  const update = useCallback(
    async (id: string, input: UpdateTaskInput) => {
      const updated = await updateTask(serverUrl, authToken, id, input);
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === id ? updated : t)).filter((t) => t.status !== "done")),
      );
      return updated;
    },
    [serverUrl, authToken],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTask(serverUrl, authToken, id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [serverUrl, authToken],
  );

  return { tasks, isLoading, isRefreshing, error, refresh, add, update, remove };
}
