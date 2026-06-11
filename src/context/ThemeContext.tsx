import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palettes, ColorPalette } from '../constants/Colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode:    ThemeMode;   // preferensi user: 'light' | 'dark' | 'system'
  isDark:  boolean;     // hasil akhir setelah resolve 'system'
  colors:  ColorPalette;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = '@theme_mode_v1';

const ThemeContext = createContext<ThemeContextType>({
  mode:    'system',
  isDark:  false,
  colors:  Palettes.light,
  setMode: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    }).catch(() => {});
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? Palettes.dark : Palettes.light;

  const toggleTheme = () => setMode(isDark ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
