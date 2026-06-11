import * as SecureStore from 'expo-secure-store';

const SAVED_ACCOUNTS_KEY = 'saved_accounts';
const MAX_ACCOUNTS = 5;

export interface SavedAccount {
  username:  string;
  name:      string;
  authApi:   string;
  authKey:   string;
  authToken: string;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Simpan/perbarui akun — taruh di urutan paling atas, dedup by username
export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(a => a.username !== account.username);
  filtered.unshift(account);
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered.slice(0, MAX_ACCOUNTS)));
}

export async function removeSavedAccount(username: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(a => a.username !== username);
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
}
