import { use, useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  ActivityIndicator,
  TextInput,
  Pressable,
  PlatformColor,
} from "react-native";
import { Picker, Host, ContextMenu, Button, DateTimePicker } from "@expo/ui/swift-ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ConnectionContext } from "@/hooks/use-connection";
import { type Task, type Priority, fetchTask, updateTask, deleteTask } from "@/utils/api";
import { STATUSES, STATUS_LABELS, PRIORITY_LABELS } from "@/utils/task-constants";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { serverUrl, authToken } = use(ConnectionContext);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTask(serverUrl, authToken, id)
      .then((t) => {
        setTask(t);
        setError(null);
      })
      .catch(() => {
        setError("Failed to load task. Check that oru server is running.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [serverUrl, authToken, id]);

  const handleStatusChange = useCallback(
    async (event: { nativeEvent: { index: number; label: string } }) => {
      if (!task) {
        return;
      }
      const status = STATUSES[event.nativeEvent.index];
      try {
        const updated = await updateTask(serverUrl, authToken, task.id, { status });
        setTask(updated);
      } catch {
        Alert.alert("Error", "Failed to update status.");
      }
    },
    [task, serverUrl, authToken],
  );

  const handlePriorityChange = useCallback(
    async (newPriority: Priority) => {
      if (!task) {
        return;
      }
      try {
        const updated = await updateTask(serverUrl, authToken, task.id, { priority: newPriority });
        setTask(updated);
      } catch {
        Alert.alert("Error", "Failed to update priority.");
      }
    },
    [task, serverUrl, authToken],
  );

  const handleTitleSave = useCallback(async () => {
    if (!task) {
      return;
    }
    const trimmed = editedTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const updated = await updateTask(serverUrl, authToken, task.id, { title: trimmed });
      setTask(updated);
      setIsEditingTitle(false);
    } catch {
      Alert.alert("Error", "Failed to update title.");
    }
  }, [task, editedTitle, serverUrl, authToken]);

  const handleAddNote = useCallback(async () => {
    if (!task) {
      return;
    }
    const trimmed = newNote.trim();
    if (!trimmed) {
      return;
    }
    try {
      const updated = await updateTask(serverUrl, authToken, task.id, { note: trimmed });
      setTask(updated);
      setNewNote("");
    } catch {
      Alert.alert("Error", "Failed to add note.");
    }
  }, [task, newNote, serverUrl, authToken]);

  const handleAddLabel = useCallback(async () => {
    if (!task) {
      return;
    }
    const trimmed = newLabel.trim();
    if (!trimmed || task.labels.includes(trimmed)) {
      setIsAddingLabel(false);
      setNewLabel("");
      return;
    }
    try {
      const updated = await updateTask(serverUrl, authToken, task.id, {
        labels: [...task.labels, trimmed],
      });
      setTask(updated);
      setIsAddingLabel(false);
      setNewLabel("");
    } catch {
      Alert.alert("Error", "Failed to add label.");
    }
  }, [task, newLabel, serverUrl, authToken]);

  const handleRemoveLabel = useCallback(
    async (label: string) => {
      if (!task) {
        return;
      }
      try {
        const updated = await updateTask(serverUrl, authToken, task.id, {
          labels: task.labels.filter((l) => l !== label),
        });
        setTask(updated);
      } catch {
        Alert.alert("Error", "Failed to remove label.");
      }
    },
    [task, serverUrl, authToken],
  );

  const handleDueDateChange = useCallback(
    async (date: Date) => {
      if (!task) {
        return;
      }
      const due_at = date.toISOString().split("T")[0] + "T00:00:00";
      try {
        const updated = await updateTask(serverUrl, authToken, task.id, { due_at });
        setTask(updated);
      } catch {
        Alert.alert("Error", "Failed to update due date.");
      }
    },
    [task, serverUrl, authToken],
  );

  const handleClearDueDate = useCallback(async () => {
    if (!task) {
      return;
    }
    try {
      const updated = await updateTask(serverUrl, authToken, task.id, { due_at: null });
      setTask(updated);
    } catch {
      Alert.alert("Error", "Failed to clear due date.");
    }
  }, [task, serverUrl, authToken]);

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
          try {
            await deleteTask(serverUrl, authToken, task.id);
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete task.");
          }
        },
      },
    ]);
  }, [task, serverUrl, authToken, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ fontSize: 15, color: PlatformColor("secondaryLabel"), textAlign: "center" }}>
          {error ?? "Task not found."}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Task",
          headerRight: () => (
            <Host matchContents>
              <ContextMenu activationMethod="singlePress">
                <ContextMenu.Trigger>
                  <Image
                    source="sf:ellipsis"
                    style={{ width: 22, height: 22 }}
                    tintColor={PlatformColor("label") as unknown as string}
                  />
                </ContextMenu.Trigger>
                <ContextMenu.Items>
                  <Button systemImage="trash" role="destructive" onPress={handleDelete}>
                    Delete Task
                  </Button>
                </ContextMenu.Items>
              </ContextMenu>
            </Host>
          ),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 24 }}
      >
        {isEditingTitle ? (
          <TextInput
            value={editedTitle}
            onChangeText={setEditedTitle}
            onBlur={handleTitleSave}
            onSubmitEditing={handleTitleSave}
            autoFocus
            multiline
            style={{ fontSize: 28, fontWeight: "700", color: PlatformColor("label"), padding: 0 }}
          />
        ) : (
          <Pressable
            onPress={() => {
              setEditedTitle(task.title);
              setIsEditingTitle(true);
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "700", color: PlatformColor("label") }}>
              {task.title}
            </Text>
          </Pressable>
        )}

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            STATUS
          </Text>
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
                    {PRIORITY_LABELS[task.priority]}
                  </Text>
                  <Image
                    source="sf:chevron.up.chevron.down"
                    style={{ width: 12, height: 12 }}
                    tintColor={PlatformColor("secondaryLabel") as unknown as string}
                  />
                </View>
              </ContextMenu.Trigger>
              <ContextMenu.Items>
                <Button
                  systemImage="exclamationmark.3"
                  onPress={() => handlePriorityChange("urgent")}
                >
                  Urgent
                </Button>
                <Button
                  systemImage="exclamationmark.2"
                  onPress={() => handlePriorityChange("high")}
                >
                  High
                </Button>
                <Button systemImage="minus" onPress={() => handlePriorityChange("medium")}>
                  Medium
                </Button>
                <Button systemImage="arrow.down" onPress={() => handlePriorityChange("low")}>
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
                initialDate={task.due_at}
                onDateSelected={handleDueDateChange}
                variant="compact"
                displayedComponents="date"
              />
            </Host>
            {task.due_at && (
              <Pressable onPress={handleClearDueDate} hitSlop={8}>
                <Image
                  source="sf:xmark.circle.fill"
                  style={{ width: 20, height: 20 }}
                  tintColor={PlatformColor("secondaryLabel") as unknown as string}
                />
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            LABELS
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {task.labels.map((label) => (
              <Host key={label} matchContents>
                <ContextMenu activationMethod="singlePress">
                  <ContextMenu.Trigger>
                    <View
                      style={{
                        backgroundColor: PlatformColor("tertiarySystemFill"),
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                        borderCurve: "continuous",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: PlatformColor("label") }}>{label}</Text>
                    </View>
                  </ContextMenu.Trigger>
                  <ContextMenu.Items>
                    <Button
                      systemImage="trash"
                      role="destructive"
                      onPress={() => handleRemoveLabel(label)}
                    >
                      Remove
                    </Button>
                  </ContextMenu.Items>
                </ContextMenu>
              </Host>
            ))}
            {isAddingLabel ? (
              <TextInput
                value={newLabel}
                onChangeText={setNewLabel}
                onBlur={handleAddLabel}
                onSubmitEditing={handleAddLabel}
                autoFocus
                placeholder="Label"
                placeholderTextColor={PlatformColor("placeholderText")}
                style={{
                  fontSize: 14,
                  color: PlatformColor("label"),
                  backgroundColor: PlatformColor("tertiarySystemFill"),
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderCurve: "continuous",
                  minWidth: 60,
                }}
              />
            ) : (
              <Pressable
                onPress={() => setIsAddingLabel(true)}
                style={{
                  backgroundColor: PlatformColor("tertiarySystemFill"),
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderCurve: "continuous",
                }}
              >
                <Text style={{ fontSize: 14, color: PlatformColor("secondaryLabel") }}>+</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: PlatformColor("secondaryLabel") }}>
            NOTES
          </Text>
          {task.notes.map((note, i) => (
            <Text
              key={i}
              selectable
              style={{ fontSize: 15, color: PlatformColor("label"), lineHeight: 22 }}
            >
              {note}
            </Text>
          ))}
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            onSubmitEditing={handleAddNote}
            placeholder="Add a note..."
            placeholderTextColor={PlatformColor("placeholderText")}
            returnKeyType="done"
            style={{
              fontSize: 15,
              color: PlatformColor("label"),
              backgroundColor: PlatformColor("tertiarySystemFill"),
              padding: 10,
              borderRadius: 8,
              borderCurve: "continuous",
            }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text selectable style={{ fontSize: 13, color: PlatformColor("tertiaryLabel") }}>
            Created {new Date(task.created_at).toLocaleDateString()}
          </Text>
          <Text selectable style={{ fontSize: 13, color: PlatformColor("tertiaryLabel") }}>
            Updated {new Date(task.updated_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
