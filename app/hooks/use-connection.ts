import { useState, useEffect, useCallback, createContext } from "react";
import {
  getServerUrl,
  setServerUrl as storeServerUrl,
  getAuthToken,
  setAuthToken as storeAuthToken,
  clearConnection,
} from "@/utils/connection";

export interface ConnectionState {
  serverUrl: string | null;
  authToken: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: (url: string, token: string | null) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const ConnectionContext = createContext<ConnectionState>({
  serverUrl: null,
  authToken: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
});

export function useConnectionProvider(): ConnectionState {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getServerUrl(), getAuthToken()]).then(([url, token]) => {
      setServerUrl(url);
      setAuthToken(token);
      setIsLoading(false);
    });
  }, []);

  const connect = useCallback(async (url: string, token: string | null) => {
    await storeServerUrl(url);
    if (token) {
      await storeAuthToken(token);
    }
    setServerUrl(url);
    setAuthToken(token);
  }, []);

  const disconnect = useCallback(async () => {
    await clearConnection();
    setServerUrl(null);
    setAuthToken(null);
  }, []);

  return {
    serverUrl,
    authToken,
    isConnected: serverUrl !== null,
    isLoading,
    connect,
    disconnect,
  };
}
