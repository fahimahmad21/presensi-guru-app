import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { NotifBadgeProvider } from './src/context/NotifBadgeContext';
import RootNavigator from './src/navigation';
import { mintaIzinNotifikasi, jadwalkanReminderHarian } from './src/services/NotificationService';
import { startWS, stopWS } from './src/services/wsService';

function WSManager() {
  const { isLoggedIn } = useAuth();
  useEffect(() => {
    if (isLoggedIn) startWS(); else stopWS();
    return () => { if (!isLoggedIn) stopWS(); };
  }, [isLoggedIn]);
  return null;
}

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Minta izin notifikasi + jadwalkan reminder saat app pertama kali dibuka
  useEffect(() => {
    (async () => {
      const izin = await mintaIzinNotifikasi();
      if (izin) {
        await jadwalkanReminderHarian();
      }
    })();

    // Tangani ketika user klik notifikasi saat app closed/background
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      console.log('[Notif klik]', data?.tipe);
      // TODO: navigasi ke screen yang relevan berdasarkan data.tipe
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <NotifBadgeProvider>
          <WSManager />
          <SafeAreaProvider>
            <NavigationContainer>
              <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                <StatusBar style="light" />
                <RootNavigator />
              </View>
            </NavigationContainer>
          </SafeAreaProvider>
          </NotifBadgeProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
