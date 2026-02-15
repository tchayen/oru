import { use, useEffect, useState, useCallback } from "react";
import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator } from "react-native";
import { Picker, Host } from "@expo/ui/swift-ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
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

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
    async (event: { nativeEvent: { index: number; label: string } }) => {
      if (!task) {
        return;
      }
      const status = STATUSES[event.nativeEvent.index];
      const updated = await updateTask(serverUrl, task.id, { status });
      setTask(updated);
    },
    [task, serverUrl],
  );

  const handlePriorityChange = useCallback(
    async (event: { nativeEvent: { index: number; label: string } }) => {
      if (!task) {
        return;
      }
      const priority = PRIORITIES[event.nativeEvent.index];
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
          <Host matchContents>
            <Picker
              options={STATUSES.map((s) => STATUS_LABELS[s])}
              selectedIndex={STATUSES.indexOf(task.status)}
              onOptionSelected={handleStatusChange}
              variant="segmented"
            />
          </Host>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>PRIORITY</Text>
          <Host matchContents>
            <Picker
              options={PRIORITIES.map((p) => PRIORITY_LABELS[p])}
              selectedIndex={PRIORITIES.indexOf(task.priority)}
              onOptionSelected={handlePriorityChange}
              variant="segmented"
            />
          </Host>
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
              <Text key={i} selectable style={{ fontSize: 15, color: "#3C3C43", lineHeight: 22 }}>
                {note}
              </Text>
            ))}
          </View>
        )}

        <View style={{ gap: 4 }}>
          <Text selectable style={{ fontSize: 13, color: "#C7C7CC" }}>
            Created {new Date(task.created_at).toLocaleDateString()}
          </Text>
          <Text selectable style={{ fontSize: 13, color: "#C7C7CC" }}>
            Updated {new Date(task.updated_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
