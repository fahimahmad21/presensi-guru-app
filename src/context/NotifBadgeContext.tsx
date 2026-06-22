import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotifBadgeContextType {
  unreadCount: number;
  /** Dipanggil oleh NotificationModal setelah load — sinkronkan badge ke jumlah belum dibaca yang akurat */
  syncBadge: (count: number) => void;
}

const BADGE_KEY = '@notif_badge_v1';

const NotifBadgeContext = createContext<NotifBadgeContextType>({
  unreadCount: 0,
  syncBadge: () => {},
});

export function useNotifBadge() {
  return useContext(NotifBadgeContext);
}

export function NotifBadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  // Dedup WS event di level badge — jika double-connection masih ada, tidak increment 2x
  const lastWsKey = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(BADGE_KEY)
      .then(v => { if (v) setUnreadCount(parseInt(v, 10) || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onWsEvent(msg: Record<string, unknown>) {
      const key = `${msg.id}_${msg.status}`;
      if (lastWsKey.current === key) return;
      lastWsKey.current = key;
      setTimeout(() => { lastWsKey.current = null; }, 3000);
      setUnreadCount(prev => {
        const next = prev + 1;
        AsyncStorage.setItem(BADGE_KEY, String(next)).catch(() => {});
        return next;
      });
    }
    const s1 = DeviceEventEmitter.addListener('ws:permit', onWsEvent);
    const s2 = DeviceEventEmitter.addListener('ws:absent', onWsEvent);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const syncBadge = useCallback((count: number) => {
    setUnreadCount(count);
    AsyncStorage.setItem(BADGE_KEY, String(count)).catch(() => {});
  }, []);

  return (
    <NotifBadgeContext.Provider value={{ unreadCount, syncBadge }}>
      {children}
    </NotifBadgeContext.Provider>
  );
}
