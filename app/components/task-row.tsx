import { Pressable, Text, PlatformColor } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import type { Task, Priority, Status } from "@/utils/api";

const PRIORITY_ICONS: Record<Priority, string> = {
  urgent: "exclamationmark.3",
  high: "exclamationmark.2",
  medium: "minus",
  low: "arrow.down",
};

const STATUS_ICONS: Record<Status, string> = {
  todo: "circle;weight=thin",
  in_progress: "circle.lefthalf.filled;weight=thin",
  done: "checkmark.circle.fill;weight=thin",
};

function formatDueDate(dueAt: string): { label: string; overdue: boolean } {
  const due = new Date(dueAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Overdue", overdue: true };
  }
  if (diffDays === 0) {
    return { label: "Today", overdue: false };
  }
  if (diffDays === 1) {
    return { label: "Tomorrow", overdue: false };
  }
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { label: formatted, overdue: false };
}

interface TaskRowProps {
  task: Task;
  onToggleStatus: (task: Task) => void;
}

export function TaskRow({ task, onToggleStatus }: TaskRowProps) {
  const statusIcon = STATUS_ICONS[task.status];
  const priorityIcon = PRIORITY_ICONS[task.priority];
  const dueInfo = task.due_at ? formatDueDate(task.due_at) : null;

  return (
    <Link href={`/${task.id}`} asChild>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onToggleStatus(task);
          }}
          hitSlop={8}
        >
          <Image
            source={`sf:${statusIcon}`}
            style={{ width: 24, height: 24 }}
            tintColor={
              (task.status === "done"
                ? PlatformColor("systemGreen")
                : PlatformColor("systemGray")) as unknown as string
            }
          />
        </Pressable>

        <Text
          style={{
            flex: 1,
            fontSize: 17,
            color: task.status === "done" ? PlatformColor("tertiaryLabel") : PlatformColor("label"),
            textDecorationLine: task.status === "done" ? "line-through" : "none",
          }}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {dueInfo && task.status !== "done" && (
          <Text
            style={{
              fontSize: 13,
              color: dueInfo.overdue ? PlatformColor("systemRed") : PlatformColor("secondaryLabel"),
            }}
          >
            {dueInfo.label}
          </Text>
        )}

        <Image
          source={`sf:${priorityIcon}`}
          style={{ width: 16, height: 16 }}
          tintColor={PlatformColor("secondaryLabel") as unknown as string}
        />
      </Pressable>
    </Link>
  );
}
