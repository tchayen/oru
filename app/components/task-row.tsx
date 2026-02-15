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

interface TaskRowProps {
  task: Task;
  onToggleStatus: (task: Task) => void;
}

export function TaskRow({ task, onToggleStatus }: TaskRowProps) {
  const statusIcon = STATUS_ICONS[task.status];
  const priorityIcon = PRIORITY_ICONS[task.priority];

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

        <Image
          source={`sf:${priorityIcon}`}
          style={{ width: 16, height: 16 }}
          tintColor={PlatformColor("secondaryLabel") as unknown as string}
        />
      </Pressable>
    </Link>
  );
}
