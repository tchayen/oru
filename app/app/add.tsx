import { use, useState } from "react";
import { ScrollView, Text, View, TextInput, Pressable, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ConnectionContext } from "@/hooks/use-connection";
import { type Priority, createTask } from "@/utils/api";

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#FF3B30",
  high: "#FF9500",
  medium: "#007AFF",
  low: "#8E8E93",
};

export default function AddTaskScreen() {
  const { serverUrl } = use(ConnectionContext);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert("Title required", "Please enter a task title.");
      return;
    }

    setIsSaving(true);
    try {
      await createTask(serverUrl, { title: trimmed, priority, status: "todo" });
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      Alert.alert("Error", "Failed to create task.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={isSaving} hitSlop={8}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: isSaving ? "#C7C7CC" : "#007AFF",
                }}
              >
                Save
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 24 }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={{
              fontSize: 17,
              padding: 12,
              backgroundColor: "#F2F2F7",
              borderRadius: 10,
              borderCurve: "continuous",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93" }}>PRIORITY</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {PRIORITIES.map((p) => {
              const selected = priority === p;
              const color = PRIORITY_COLORS[p];
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPriority(p);
                    if (process.env.EXPO_OS === "ios") {
                      Haptics.selectionAsync();
                    }
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderCurve: "continuous",
                    backgroundColor: selected ? color : "#F2F2F7",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: selected ? "#fff" : "#000",
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </>
  );
}
