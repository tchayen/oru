import { use, useEffect, useState, useCallback } from "react";
import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ConnectionContext } from "@/hooks/use-connection";
import {
  type Task,
  type Status,
  type Priority,
  fetchTask,
  updateTask,
  deleteTask,
} from "@/utils/api";

const STATUSES: Status[] = ["todo", "in_progress", "done"];
const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#FF3B30",
  high: "#FF9500",
  medium: "#007AFF",
  low: "#8E8E93",
};

function OptionButton({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  const bg = selected ? (color ?? "#007AFF") : "#F2F2F7";
  const fg = selected ? "#fff" : "#000";

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderCurve: "continuous",
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "500", color: fg }}>{label}</Text>
    </Pressable>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { serverUrl } = use(ConnectionContext);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTask(serverUrl, id).then((t) => {
      setTask(t);
      setIsLoading(false);
    });
  }, [serverUrl, id]);

  const handleStatusChange = useCallback(
    async (status: Status) => {
      if (!task) {
        return;
      }
      if (process.env.EXPO_OS === "ios") {
        Haptics.selectionAsync();
      }
      const updated = await updateTask(serverUrl, task.id, { status });
      setTask(updated);
    },
    [task, serverUrl],
  );

  const handlePriorityChange = useCallback(
    async (priority: Priority) => {
      if (!task) {
        return;
      }
      if (process.env.EXPO_OS === "ios") {
        Haptics.selectionAsync();
      }
      const updated = await updateTask(serverUrl, task.id, { priority });
      setTask(updated);
    },
    [task, serverUrl],
  );

  const handleDelete = useCallback(() => {
    if (!task) {
      return;
    }
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTask(serverUrl, task.id);
          router.back();
        },
      },
    ]);
  }, [task, serverUrl, router]);

  if (isLoading || !task) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Task",
          headerRight: () => (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <Image source="sf:trash" style={{ width: 20, height: 20 }} tintColor="#FF3B30" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 24 }}
      >
        <Text selectable style={{ fontSize: 28, fontWeight: "700" }}>
          {task.title}
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>STATUS</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <OptionButton
                key={s}
                label={STATUS_LABELS[s]}
                selected={task.status === s}
                onPress={() => handleStatusChange(s)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>PRIORITY</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {PRIORITIES.map((p) => (
              <OptionButton
                key={p}
                label={p.charAt(0).toUpperCase() + p.slice(1)}
                selected={task.priority === p}
                color={PRIORITY_COLORS[p]}
                onPress={() => handlePriorityChange(p)}
              />
            ))}
          </View>
        </View>

        {task.labels.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>LABELS</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {task.labels.map((label) => (
                <View
                  key={label}
                  style={{
                    backgroundColor: "#F2F2F7",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                    borderCurve: "continuous",
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#3C3C43" }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {task.notes.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>NOTES</Text>
            {task.notes.map((note, i) => (
              <Text
                key={i}
                selectable
                style={{
                  fontSize: 15,
                  color: "#3C3C43",
                  lineHeight: 22,
                }}
              >
                {note}
              </Text>
            ))}
          </View>
        )}

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, color: "#C7C7CC" }}>
            Created {new Date(task.created_at).toLocaleDateString()}
          </Text>
          <Text style={{ fontSize: 13, color: "#C7C7CC" }}>
            Updated {new Date(task.updated_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
