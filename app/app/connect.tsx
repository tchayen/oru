import { use, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ConnectionContext } from "@/hooks/use-connection";

export default function ConnectScreen() {
  const { connect } = use(ConnectionContext);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) {
      return;
    }

    try {
      new URL(data);
    } catch {
      return;
    }

    setScanned(true);
    if (process.env.EXPO_OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await connect(data);
    router.replace("/");
  };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          padding: 32,
          backgroundColor: "#000",
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "600",
            color: "#fff",
            textAlign: "center",
          }}
        >
          Camera Access
        </Text>
        <Text style={{ fontSize: 15, color: "#AEAEB2", textAlign: "center" }}>
          ao needs camera access to scan the QR code from your terminal.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: "#007AFF",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            borderCurve: "continuous",
            marginTop: 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 250,
            height: 250,
            borderRadius: 24,
            borderCurve: "continuous",
            borderWidth: 3,
            borderColor: "rgba(255, 255, 255, 0.6)",
          }}
        />
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 17, textAlign: "center" }}>
          Scan the QR code from{"\n"}
          <Text style={{ fontWeight: "600" }}>ao server start</Text>
        </Text>
      </View>

      {scanned && (
        <View
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => setScanned(false)}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 10,
              borderCurve: "continuous",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15 }}>Scan Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
