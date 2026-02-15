import { useEffect } from "react";
import { PlatformColor } from "react-native";
import { Stack } from "expo-router/stack";
import { useRouter, useSegments } from "expo-router";
import { ConnectionContext, useConnectionProvider } from "@/hooks/use-connection";

export default function RootLayout() {
  const connection = useConnectionProvider();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (connection.isLoading) {
      return;
    }

    const onConnectScreen = segments[0] === "connect";

    if (!connection.isConnected && !onConnectScreen) {
      router.replace("/connect");
    } else if (connection.isConnected && onConnectScreen) {
      router.replace("/");
    }
  }, [connection.isConnected, connection.isLoading, segments, router]);

  return (
    <ConnectionContext value={connection}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: PlatformColor("systemBackground") },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Tasks",
            headerLargeTitle: true,
            headerTintColor: PlatformColor("label") as unknown as string,
          }}
        />
        <Stack.Screen
          name="connect"
          options={{
            title: "Connect",
            presentation: "fullScreenModal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            title: "Task",
            presentation: "formSheet",
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="add"
          options={{
            title: "Add Task",
            presentation: "formSheet",
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </ConnectionContext>
  );
}
