import type { TaskService } from "../main.js";

const MAX_RESULTS = 50;

export async function resolveDynamic(
  service: TaskService,
  type: string,
  prefix: string,
): Promise<string[]> {
  if (type === "tasks") {
    const tasks = await service.list();
    return tasks
      .filter((t) => t.id.startsWith(prefix))
      .slice(0, MAX_RESULTS)
      .map((t) => `${t.id}\t${t.title}`);
  }

  if (type === "labels") {
    const tasks = await service.list();
    const labels = new Set<string>();
    for (const task of tasks) {
      for (const label of task.labels) {
        if (label.startsWith(prefix)) {
          labels.add(label);
        }
      }
    }
    return [...labels].sort().slice(0, MAX_RESULTS);
  }

  return [];
}
