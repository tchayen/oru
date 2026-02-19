import { use, useState } from "react";
import { ScrollView, Text, View, TextInput, Pressable, Alert, PlatformColor } from "react-native";
import { Host, ContextMenu, Button, DateTimePicker } from "@expo/ui/swift-ui";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ConnectionContext } from "@/hooks/use-connection";
import { createTask } from "@/utils/api";
import type { Priority } from "@/utils/api";
import { PRIORITY_LABELS } from "@/utils/task-constants";

export default function AddTaskScreen() {
  const { serverUrl, authToken } = use(ConnectionContext);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert("Title required", "Please enter a task title.");
      return;
    }

    setIsSaving(true);
    try {
      await createTask(serverUrl, authToken, {
        title: trimmed,
        priority,
        status: "todo",
        due_at: dueAt,
      });
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
            <Pressable onPress={handleSave} disabled={isSaving || !title.trim()} hitSlop={8}>
              <Image
                source="sf:checkmark"
                style={{ width: 22, height: 22 }}
                tintColor={
                  (isSaving || !title.trim()
                    ? PlatformColor("tertiaryLabel")
                    : PlatformColor("link")) as unknown as string
                }
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 24 }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            TITLE
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={PlatformColor("placeholderText")}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={{
              fontSize: 17,
              padding: 12,
              color: PlatformColor("label"),
              backgroundColor: PlatformColor("tertiarySystemFill"),
              borderRadius: 10,
              borderCurve: "continuous",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            PRIORITY
          </Text>
          <Host matchContents>
            <ContextMenu activationMethod="singlePress">
              <ContextMenu.Trigger>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: PlatformColor("tertiarySystemFill"),
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderCurve: "continuous",
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "500", color: PlatformColor("label") }}>
                    {PRIORITY_LABELS[priority]}
                  </Text>
                  <Image
                    source="sf:chevron.up.chevron.down"
                    style={{ width: 12, height: 12 }}
                    tintColor={PlatformColor("secondaryLabel") as unknown as string}
                  />
                </View>
              </ContextMenu.Trigger>
              <ContextMenu.Items>
                <Button systemImage="exclamationmark.3" onPress={() => setPriority("urgent")}>
                  Urgent
                </Button>
                <Button systemImage="exclamationmark.2" onPress={() => setPriority("high")}>
                  High
                </Button>
                <Button systemImage="minus" onPress={() => setPriority("medium")}>
                  Medium
                </Button>
                <Button systemImage="arrow.down" onPress={() => setPriority("low")}>
                  Low
                </Button>
              </ContextMenu.Items>
            </ContextMenu>
          </Host>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            DUE DATE
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Host matchContents>
              <DateTimePicker
                initialDate={dueAt}
                onDateSelected={(date: Date) => {
                  setDueAt(`${date.toISOString().split("T")[0]}T00:00:00`);
                }}
                variant="compact"
                displayedComponents="date"
              />
            </Host>
            {dueAt && (
              <Pressable onPress={() => setDueAt(null)} hitSlop={8}>
                <Image
                  source="sf:xmark.circle.fill"
                  style={{ width: 20, height: 20 }}
                  tintColor={PlatformColor("secondaryLabel") as unknown as string}
                />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}
