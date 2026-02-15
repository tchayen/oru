import { useState, useEffect, useCallback, createContext } from "react";
import { getServerUrl, setServerUrl as storeServerUrl, clearServerUrl } from "@/utils/connection";

export interface ConnectionState {
  serverUrl: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: (url: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const ConnectionContext = createContext<ConnectionState>({
  serverUrl: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
});

export function useConnectionProvider(): ConnectionState {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getServerUrl().then((url) => {
      setServerUrl(url);
      setIsLoading(false);
    });
  }, []);

  const connect = useCallback(async (url: string) => {
    await storeServerUrl(url);
    setServerUrl(url);
  }, []);

  const disconnect = useCallback(async () => {
    await clearServerUrl();
    setServerUrl(null);
  }, []);

  return {
    serverUrl,
    isConnected: serverUrl !== null,
    isLoading,
    connect,
    disconnect,
  };
}
