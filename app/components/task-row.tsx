import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import type { Task, Priority, Status } from "@/utils/api";

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#FF3B30",
  high: "#FF9500",
  medium: "#007AFF",
  low: "#8E8E93",
};

const STATUS_ICONS: Record<Status, string> = {
  todo: "circle",
  in_progress: "circle.lefthalf.filled",
  done: "checkmark.circle.fill",
};

interface TaskRowProps {
  task: Task;
  onToggleStatus: (task: Task) => void;
}

export function TaskRow({ task, onToggleStatus }: TaskRowProps) {
  const statusIcon = STATUS_ICONS[task.status];
  const priorityColor = PRIORITY_COLORS[task.priority];

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
            tintColor={task.status === "done" ? "#34C759" : "#8E8E93"}
          />
        </Pressable>

        <Text
          style={{
            flex: 1,
            fontSize: 17,
            color: task.status === "done" ? "#8E8E93" : "#000",
            textDecorationLine: task.status === "done" ? "line-through" : "none",
          }}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            borderCurve: "continuous",
            backgroundColor: priorityColor + "1A",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: priorityColor }}>
            {task.priority}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
