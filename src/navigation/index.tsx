import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashLoadingScreen from '../components/SplashLoadingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isLoggedIn, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // Render app di belakang splash agar sudah siap saat splash menghilang
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isLoggedIn ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>

      {!splashDone && (
        <SplashLoadingScreen
          isReady={!isLoading}
          onHide={() => setSplashDone(true)}
        />
      )}
    </>
  );
}
