import * as SecureStore from "expo-secure-store";

const SERVER_URL_KEY = "oru_server_url";
const AUTH_TOKEN_KEY = "oru_auth_token";

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_URL_KEY);
}

export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
}

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(SERVER_URL_KEY);
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
