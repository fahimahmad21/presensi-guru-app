import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { BASE_URL, WEBSITE_TOKEN, WEBSITE_DOMAIN } from '../constants/api';
import { AUTH_KEYS } from './apiClient';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

async function getFcmToken(): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data as string;
  } catch {
    return null;
  }
}

export async function subscribeFCM(): Promise<void> {
  if (isExpoGo) return;
  try {
    const [fcmToken, authSocket] = await Promise.all([
      getFcmToken(),
      SecureStore.getItemAsync(AUTH_KEYS.SOCKET),
    ]);
    if (!fcmToken || !authSocket) return;

    await fetch(`${BASE_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Website-Token':  WEBSITE_TOKEN,
        'Website-Domain': WEBSITE_DOMAIN,
        'Auth-Socket':    authSocket,
      },
      body: JSON.stringify({ endpoint: fcmToken }),
    });
    console.log('[FCM] subscribed');
  } catch (e) {
    console.warn('[FCM] subscribe failed:', e);
  }
}

export async function unsubscribeFCM(): Promise<void> {
  if (isExpoGo) return;
  try {
    const [fcmToken, authSocket] = await Promise.all([
      getFcmToken(),
      SecureStore.getItemAsync(AUTH_KEYS.SOCKET),
    ]);
    if (!fcmToken || !authSocket) return;

    await fetch(`${BASE_URL}/subscribe`, {
      method: 'DELETE',
      headers: {
        'Content-Type':   'application/json',
        'Website-Token':  WEBSITE_TOKEN,
        'Website-Domain': WEBSITE_DOMAIN,
        'Auth-Socket':    authSocket,
      },
      body: JSON.stringify({ endpoint: fcmToken }),
    });
    console.log('[FCM] unsubscribed');
  } catch (e) {
    console.warn('[FCM] unsubscribe failed:', e);
  }
}
