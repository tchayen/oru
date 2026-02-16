import { use } from "react";
import {
  FlatList,
  ActivityIndicator,
  View,
  Text,
  Pressable,
  Alert,
  PlatformColor,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ConnectionContext } from "@/hooks/use-connection";
import { useTasks } from "@/hooks/use-tasks";
import { TaskRow } from "@/components/task-row";
import type { Task, Status } from "@/utils/api";

const NEXT_STATUS: Record<Status, Status> = {
  todo: "in_progress",
  in_progress: "in_review",
  in_review: "done",
  done: "todo",
};

export default function TaskListScreen() {
  const { serverUrl, authToken, disconnect } = use(ConnectionContext);
  const { tasks, isLoading, isRefreshing, error, refresh, update } = useTasks(serverUrl, authToken);
  const router = useRouter();

  const handleToggleStatus = (task: Task) => {
    update(task.id, { status: NEXT_STATUS[task.status] });
  };

  const handleDisconnect = () => {
    Alert.alert("Disconnect", "Disconnect from server?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: disconnect },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Tasks",
          headerLeft: () => (
            <Pressable onPress={handleDisconnect} hitSlop={8}>
              <Image
                source="sf:wifi.slash"
                style={{ width: 22, height: 22 }}
                tintColor={PlatformColor("systemRed") as unknown as string}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => router.push("/add")} hitSlop={8}>
              <Image
                source="sf:plus"
                style={{ width: 22, height: 22 }}
                tintColor={PlatformColor("label") as unknown as string}
              />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            padding: 32,
          }}
        >
          <Image
            source="sf:wifi.exclamationmark"
            style={{ width: 48, height: 48, marginBottom: 8 }}
            tintColor={PlatformColor("systemRed") as unknown as string}
          />
          <Text style={{ fontSize: 20, fontWeight: "600", color: PlatformColor("label") }}>
            Server Unreachable
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: PlatformColor("secondaryLabel"),
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={refresh}
              style={{
                backgroundColor: PlatformColor("link"),
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: "continuous",
              }}
            >
              <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>Retry</Text>
            </Pressable>
            <Pressable
              onPress={disconnect}
              style={{
                backgroundColor: PlatformColor("systemRed"),
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: "continuous",
              }}
            >
              <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>Disconnect</Text>
            </Pressable>
          </View>
        </View>
      ) : tasks.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            padding: 32,
          }}
        >
          <Image
            source="sf:checkmark.circle"
            style={{ width: 48, height: 48, marginBottom: 8 }}
            tintColor={PlatformColor("systemGreen") as unknown as string}
          />
          <Text style={{ fontSize: 20, fontWeight: "600", color: PlatformColor("label") }}>
            All done!
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: PlatformColor("secondaryLabel"),
              textAlign: "center",
            }}
          >
            No open tasks. Tap + to add one.
          </Text>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskRow task={item} onToggleStatus={handleToggleStatus} />}
          refreshing={isRefreshing}
          onRefresh={refresh}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 0.5,
                backgroundColor: PlatformColor("separator"),
                marginLeft: 52,
              }}
            />
          )}
        />
      )}
    </>
  );
}
