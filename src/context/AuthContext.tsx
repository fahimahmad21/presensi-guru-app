import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveAuthTokens, clearAuthTokens, hasAuthTokens } from '../services/apiClient';
import { login as apiLogin, getProfile, updateAvatar as apiUpdateAvatar } from '../services/authService';
import { saveAccount, SavedAccount } from '../services/accountService';
import { subscribeFCM, unsubscribeFCM } from '../services/fcmService';

export interface UserProfile {
  country:  number;
  code:     string;
  name:     string;
  email:    string;
  phone:    number;
  gender:   string;
  address:  string;
  place:    string | null;
  birthday: string | null;
  images:   string; // Base64 foto profil
}

interface AuthContextType {
  isLoggedIn:   boolean;
  isLoading:    boolean;
  user:         UserProfile | null;
  login:        (username: string, password: string) => Promise<void>;
  loginWithSavedAccount: (account: SavedAccount) => Promise<void>;
  logout:       () => Promise<void>;
  updateFoto:   (base64: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn:     false,
  isLoading:      true,
  user:           null,
  login:          async () => {},
  loginWithSavedAccount: async () => {},
  logout:         async () => {},
  updateFoto:     async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading,  setIsLoading]  = useState(true);
  const [user,       setUser]       = useState<UserProfile | null>(null);

  // Cek session tersimpan saat app pertama dibuka
  useEffect(() => {
    (async () => {
      try {
        const hasTokens = await hasAuthTokens();
        if (hasTokens) {
          const res = await getProfile();
          if (res.data.status) {
            setUser(res.data.data);
            setIsLoggedIn(true);
          }
        }
      } catch {
        await clearAuthTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    if (!res.data.status) throw new Error(res.data.message);

    const { 'Auth-Api': api, 'Auth-Key': key, 'Auth-Token': token, 'Auth-Socket': socket, name } = res.data.data;
    console.log('[Auth-Socket]', socket);
    await saveAuthTokens(api, key, token, socket);

    // Ambil data profil lengkap termasuk foto — gunakan name dari profil agar selalu sinkron
    const profile = await getProfile();
    if (profile.data.status) setUser(profile.data.data);
    const savedName = profile.data.data?.name ?? name;

    try {
      await saveAccount({ username, name: savedName, authApi: api, authKey: key, authToken: token, authSocket: socket });
    } catch (e) {
      console.warn('Gagal menyimpan akun:', e);
    }

    setIsLoggedIn(true);
    subscribeFCM().catch(() => {});
  };

  // Login cepat memakai token akun tersimpan (tanpa password)
  const loginWithSavedAccount = async (account: SavedAccount) => {
    await saveAuthTokens(account.authApi, account.authKey, account.authToken, account.authSocket);
    try {
      const profile = await getProfile();
      if (!profile.data.status) throw new Error('Sesi berakhir');
      setUser(profile.data.data);
      setIsLoggedIn(true);
      subscribeFCM().catch(() => {});
      // Perbarui nama di riwayat login jika sudah berubah di backend
      const freshName = profile.data.data?.name;
      if (freshName && freshName !== account.name) {
        await saveAccount({ ...account, name: freshName });
      }
    } catch (e) {
      await clearAuthTokens();
      throw e;
    }
  };

  const logout = async () => {
    await unsubscribeFCM().catch(() => {});
    await clearAuthTokens();
    await AsyncStorage.multiRemove(['@ws_notifs_v1', '@notif_badge_v1', '@notif_read_v1']);
    setUser(null);
    setIsLoggedIn(false);
  };

  const updateFoto = async (base64: string) => {
    await apiUpdateAvatar(base64);
    setUser(prev => prev ? { ...prev, images: base64 } : prev);
  };

  const refreshProfile = async () => {
    const res = await getProfile();
    if (res.data.status) setUser(res.data.data);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, user, login, loginWithSavedAccount, logout, updateFoto, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
