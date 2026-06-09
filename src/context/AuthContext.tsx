import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveAuthTokens, clearAuthTokens, hasAuthTokens } from '../services/apiClient';
import { login as apiLogin, getProfile, updateAvatar as apiUpdateAvatar } from '../services/authService';

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
  logout:       () => Promise<void>;
  updateFoto:   (base64: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn:     false,
  isLoading:      true,
  user:           null,
  login:          async () => {},
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

    const { 'Auth-Api': api, 'Auth-Key': key, 'Auth-Token': token } = res.data.data;
    await saveAuthTokens(api, key, token);

    // Ambil data profil lengkap termasuk foto
    const profile = await getProfile();
    if (profile.data.status) setUser(profile.data.data);

    setIsLoggedIn(true);
  };

  const logout = async () => {
    await clearAuthTokens();
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
    <AuthContext.Provider value={{ isLoggedIn, isLoading, user, login, logout, updateFoto, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
