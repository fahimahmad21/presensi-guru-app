import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, WEBSITE_TOKEN, WEBSITE_DOMAIN } from '../constants/api';

export const AUTH_KEYS = {
  API:    'Auth-Api',
  KEY:    'Auth-Key',
  TOKEN:  'Auth-Token',
  SOCKET: 'Auth-Socket',
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type':  'application/json',
    'Website-Token': WEBSITE_TOKEN,
    'Website-Domain': WEBSITE_DOMAIN,
  },
});

// Sisipkan Auth headers di setiap request
apiClient.interceptors.request.use(async (config) => {
  const [api, key, token] = await Promise.all([
    SecureStore.getItemAsync(AUTH_KEYS.API),
    SecureStore.getItemAsync(AUTH_KEYS.KEY),
    SecureStore.getItemAsync(AUTH_KEYS.TOKEN),
  ]);
  if (api)   config.headers[AUTH_KEYS.API]   = api;
  if (key)   config.headers[AUTH_KEYS.KEY]   = key;
  if (token) config.headers[AUTH_KEYS.TOKEN] = token;
  return config;
});

export async function saveAuthTokens(api: string, key: string, token: string, socket?: string) {
  await Promise.all([
    SecureStore.setItemAsync(AUTH_KEYS.API,   api),
    SecureStore.setItemAsync(AUTH_KEYS.KEY,   key),
    SecureStore.setItemAsync(AUTH_KEYS.TOKEN, token),
    socket ? SecureStore.setItemAsync(AUTH_KEYS.SOCKET, socket) : Promise.resolve(),
  ]);
}

export async function clearAuthTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_KEYS.API),
    SecureStore.deleteItemAsync(AUTH_KEYS.KEY),
    SecureStore.deleteItemAsync(AUTH_KEYS.TOKEN),
    SecureStore.deleteItemAsync(AUTH_KEYS.SOCKET),
  ]);
}

export async function getAuthSocket(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_KEYS.SOCKET);
}

export async function hasAuthTokens(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(AUTH_KEYS.TOKEN);
  return !!token;
}

export default apiClient;
